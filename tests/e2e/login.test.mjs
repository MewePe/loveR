// Failed-login rate limiting (lib/loginThrottle.ts): 5 failures per email / 20 per IP within 15 minutes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, ensureServer, createUsers, cleanupUsers, Client, uuid } from './helpers.mjs';

let db, ids, emails;
const testIps = [];
const unknownEmail = `e2e-nobody-${uuid().slice(0, 8)}@test.local`;

// Each test uses its own fake client IP so limits don't leak between tests (or onto the developer's own logins)
function clientFromNewIp() {
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}-${uuid().slice(0, 6)}`;
    testIps.push(ip);
    return new Client({ 'x-forwarded-for': ip });
}

before(async () => {
    await ensureServer();
    db = await connectDb();
    ({ ids, emails } = await createUsers(db, { victim: 'READER', other: 'READER', resetter: 'READER', shared: 'READER' }));
});

after(async () => {
    if (db) {
        await db.query('DELETE FROM login_attempts WHERE email IN (?) OR ip IN (?)',
            [[...Object.values(emails || {}), unknownEmail], testIps.length ? testIps : ['-']]);
        await cleanupUsers(db, Object.values(ids || {}));
        await db.end();
    }
});

async function failLogins(client, email, times) {
    for (let i = 0; i < times; i++) {
        assert.equal(await client.login(email, 'wrong-password'), false);
    }
}

test('5 wrong passwords lock the account, even for the correct password', async () => {
    const client = clientFromNewIp();
    await failLogins(client, emails.victim, 5);
    assert.equal(client.lastLoginCode, 'credentials', 'normal failures report wrong credentials');
    assert.equal(await client.login(emails.victim), false, 'correct password rejected while locked');
    assert.equal(client.lastLoginCode, 'rate_limited');
    assert.equal(await clientFromNewIp().login(emails.victim), false, 'lock is per account, not per IP');
});

test('the lock is per email: other accounts still log in', async () => {
    assert.equal(await clientFromNewIp().login(emails.other), true);
});

test('email case does not bypass the lock', async () => {
    const client = clientFromNewIp();
    assert.equal(await client.login(emails.victim.toUpperCase()), false);
    assert.equal(client.lastLoginCode, 'rate_limited');
});

test('the lock expires after the window', async () => {
    // Simulate time passing by ageing the recorded failures
    await db.query('UPDATE login_attempts SET created_at = NOW() - INTERVAL 16 MINUTE WHERE email = ?', [emails.victim]);
    assert.equal(await clientFromNewIp().login(emails.victim), true);
});

test('a successful login resets the failure count', async () => {
    const client = clientFromNewIp();
    await failLogins(client, emails.resetter, 4);
    assert.equal(await client.login(emails.resetter), true);
    await failLogins(clientFromNewIp(), emails.resetter, 4);
    assert.equal(await clientFromNewIp().login(emails.resetter), true, 'only 4 failures since the last success');
});

test('unknown emails are limited the same way (no account enumeration)', async () => {
    const client = clientFromNewIp();
    await failLogins(client, unknownEmail, 5);
    assert.equal(client.lastLoginCode, 'credentials');
    await client.login(unknownEmail, 'anything');
    assert.equal(client.lastLoginCode, 'rate_limited');
});

test('20 failures from one IP block that IP, not others', async () => {
    const attacker = clientFromNewIp();
    for (let i = 0; i < 20; i++) {
        await attacker.login(`e2e-spray-${i}-${uuid().slice(0, 4)}@test.local`, 'wrong-password');
    }
    assert.equal(await attacker.login(emails.shared), false, 'valid login blocked from the attacking IP');
    assert.equal(attacker.lastLoginCode, 'rate_limited');
    assert.equal(await clientFromNewIp().login(emails.shared), true, 'same account fine from another IP');
    await db.query("DELETE FROM login_attempts WHERE email LIKE 'e2e-spray-%@test.local'");
});
