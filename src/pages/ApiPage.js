import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { HiOutlineDocumentDuplicate, HiOutlineKey } from 'react-icons/hi2';
import Dialog from '../components/Dialog';
import { CardSkeleton } from '../components/Skeleton';
import { useRefresh } from '../hooks/useRefresh';
import { me, rotateApiKey } from '../services/api';

const SAMPLE_ID = 'a1b2c3d4e5f67890a1b2c3d4e5f67890';
const SAMPLE_ADDRESS = '0x1111111111111111111111111111111111111111';
const PAYOUT_A = '0x2222222222222222222222222222222222222222';
const PAYOUT_B = '0x3333333333333333333333333333333333333333';

const CREATE_RESPONSE = `{
  "success": true,
  "deposit": {
    "id": "${SAMPLE_ID}",
    "username": "merchant",
    "address": "${SAMPLE_ADDRESS}",
    "status": "waiting",
    "receivedAmount": "0.000000000000000000",
    "receivedTxHash": null,
    "fromAddress": null,
    "chargeAmount": "0.000000000000000000",
    "errorMessage": null,
    "createdAt": "2026-10-08T08:30:00.000Z",
    "payouts": []
  }
}`;

const READ_RESPONSE = `{
  "success": true,
  "deposit": {
    "id": "${SAMPLE_ID}",
    "username": "merchant",
    "address": "${SAMPLE_ADDRESS}",
    "status": "completed",
    "receivedAmount": "100.000000000000000000",
    "receivedTxHash": "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1",
    "fromAddress": "0x4444444444444444444444444444444444444444",
    "chargeAmount": "3.000000000000000000",
    "errorMessage": null,
    "createdAt": "2026-10-08T08:30:00.000Z",
    "payouts": [
      {
        "id": 18,
        "label": "Treasury",
        "toAddress": "${PAYOUT_A}",
        "percent": "60.0000",
        "amount": "60.000000000000000000",
        "txHash": "0xdef456def456def456def456def456def456def456def456def456def456def4",
        "status": "completed",
        "errorMessage": null
      },
      {
        "id": 19,
        "label": "Operations",
        "toAddress": "${PAYOUT_B}",
        "percent": "40.0000",
        "amount": "40.000000000000000000",
        "txHash": "0x789abc789abc789abc789abc789abc789abc789abc789abc789abc789abc789a",
        "status": "completed",
        "errorMessage": null
      }
    ]
  }
}`;

const ERROR_RESPONSE = `{
  "success": false,
  "message": "API key required"
}`;

const DEPOSIT_FIELDS = [
  ['id', 'string', 'Public id, 32 hex characters. Use this in the read URL. It is not the database id.'],
  ['username', 'string', 'Account that owns the request.'],
  ['address', 'string', 'BEP-20 address that should receive the USDT. The split is sent from this same address.'],
  ['status', 'string', 'waiting, distributing, insufficient_balance, completed, failed, or expired.'],
  ['receivedAmount', 'string', 'USDT seen on the address. Decimal string with up to 18 places. "0.000000000000000000" until a transfer arrives.'],
  ['receivedTxHash', 'string or null', 'Hash of the incoming transfer, when the watcher can read it.'],
  ['fromAddress', 'string or null', 'Address that sent the USDT, when known.'],
  ['chargeAmount', 'string', 'Virtual-wallet charge for this deposit. "0.000000000000000000" until the split starts.'],
  ['errorMessage', 'string or null', 'Why the deposit is waiting on a balance or why a split failed.'],
  ['createdAt', 'string', 'UTC timestamp.'],
  ['payouts', 'array', 'Empty until the split is planned. Then one object per active payout address.'],
];

const PAYOUT_FIELDS = [
  ['id', 'number', 'Payout row id.'],
  ['label', 'string', 'Label from the payout split at the time the split was planned.'],
  ['toAddress', 'string', 'Destination of this share.'],
  ['percent', 'string', 'Share of the received USDT.'],
  ['amount', 'string', 'USDT sent, or waiting to be sent, for this share. The last share receives any rounding remainder.'],
  ['txHash', 'string or null', 'Transfer hash after this share is sent.'],
  ['status', 'string', 'pending, completed, or failed.'],
  ['errorMessage', 'string or null', 'Chain error for this share, when the transfer did not complete.'],
];

const DEPOSIT_STATUSES = [
  ['waiting', 'Address is assigned. No USDT has been recorded yet. The address is released if no USDT arrives within 15 minutes.'],
  ['expired', 'No USDT arrived within 15 minutes. The address is no longer reserved. Request a new address before paying.'],
  ['distributing', 'USDT was recorded and the charge was accepted. Transfers are in progress.'],
  ['insufficient_balance', 'USDT is on the address, but the virtual wallet cannot cover the charge. The USDT stays there. After a top-up, the watcher tries again. The charge is not taken twice.'],
  ['completed', 'Every share was sent. The address can be assigned to a later request.'],
  ['failed', 'A transfer did not finish. errorMessage explains it. Completed shares are not sent again. An operator can retry from the admin panel.'],
];

function CodeBlock({ label, code, copied, onCopy }) {
  return (
    <div className="docs-code">
      <div className="docs-code__bar">
        <span>{label}</span>
        <button type="button" className="ghost" onClick={onCopy}>
          <HiOutlineDocumentDuplicate />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

export default function ApiPage() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const base = process.env.REACT_APP_API_URL || 'http://localhost:5741/api';

  useEffect(() => {
    me().then((data) => setUser(data.user)).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useRefresh(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await me();
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  });

  async function copyText(id, value) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement('textarea');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(id);
    setTimeout(() => setCopied(''), 1400);
  }

  async function onRotate() {
    setRotating(true);
    setError('');
    try {
      const data = await rotateApiKey();
      setUser(data.user);
      setConfirmRotate(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setRotating(false);
    }
  }

  if (loading) {
    return (
      <div className="stack">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={8} />
        <CardSkeleton lines={8} />
      </div>
    );
  }

  const createCurl = `curl -X POST "${base}/v1/deposits" \\
  -H "X-Api-Key: YOUR_API_KEY"`;
  const readCurl = `curl "${base}/v1/deposits/${SAMPLE_ID}" \\
  -H "X-Api-Key: YOUR_API_KEY"`;

  return (
    <motion.section className="stack docs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <article className="card">
        <header className="card__head">
          <h2>API key</h2>
          <span className="pill">X-Api-Key</span>
        </header>
        <p className="muted">This key authenticates the deposit API for your account. Keep it on your server. Rotating it immediately invalidates the previous key.</p>
        <div className="address-row">
          <code>{user?.apiKey}</code>
          <button type="button" className="ghost" onClick={() => copyText('key', user?.apiKey)}>
            <HiOutlineDocumentDuplicate />
            {copied === 'key' ? 'Copied' : 'Copy'}
          </button>
        </div>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="ghost" onClick={() => setConfirmRotate(true)} disabled={rotating}>
            Rotate key
          </button>
        </div>
      </article>
      <Dialog
        open={confirmRotate}
        title="Rotate this API key?"
        tone="danger"
        icon={HiOutlineKey}
        onClose={() => { if (!rotating) setConfirmRotate(false); }}
      >
        <p className="muted">The current key stops working as soon as the new one is created.</p>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="ghost" onClick={() => setConfirmRotate(false)} disabled={rotating}>Cancel</button>
          <button type="button" className="danger" onClick={onRotate} disabled={rotating}>{rotating ? 'Rotating…' : 'Rotate key'}</button>
        </div>
      </Dialog>

      <article className="card stack">
        <h2>Overview</h2>
        <p className="muted">Ask for a deposit address, send BEP-20 USDT to it, then read the request until the split finishes. The USDT is divided from that same address using the active payout split on this account. The virtual wallet pays the charge. It does not hold the USDT being split.</p>
        <div className="docs-facts">
          <div>
            <span>Base URL</span>
            <code>{base}</code>
          </div>
          <div>
            <span>Format</span>
            <strong>JSON</strong>
          </div>
          <div>
            <span>Auth header</span>
            <code>X-Api-Key</code>
          </div>
          <div>
            <span>Asset</span>
            <strong>USDT on BNB Smart Chain</strong>
          </div>
        </div>
        <ol className="docs-steps">
          <li>Set the payout split so the active percentages total 100%.</li>
          <li>Keep enough USDT in the charge wallet for the flat fee plus the percent of the deposit.</li>
          <li>Create a deposit. Send the USDT to the address in the response. One request assigns one address.</li>
          <li>Poll the read endpoint. The watcher checks about every 15 seconds.</li>
        </ol>
      </article>

      <article className="card stack">
        <h2>Conventions</h2>
        <p className="muted">Every response is JSON. A success object has <code>success: true</code>. An error object has <code>success: false</code> and a <code>message</code> string. The response never includes a stack trace or a private key.</p>
        <CodeBlock label="Error body" code={ERROR_RESPONSE} copied={copied === 'error'} onCopy={() => copyText('error', ERROR_RESPONSE)} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Status</th><th>When</th><th>message</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="pill is-failed">401</span></td>
                <td>The header is missing, blank, unknown, or belongs to an inactive account.</td>
                <td className="mono">API key required / API key is invalid</td>
              </tr>
              <tr>
                <td><span className="pill is-warn">400</span></td>
                <td>Active payout percentages do not total 100%, or the request body is not valid JSON.</td>
                <td className="mono">Payout addresses are not ready. Active percentages must total 100.</td>
              </tr>
              <tr>
                <td><span className="pill is-failed">404</span></td>
                <td>The deposit id is unknown for this key, or the path does not exist.</td>
                <td className="mono">Deposit not found</td>
              </tr>
              <tr>
                <td><span className="pill is-warn">503</span></td>
                <td>The operator has no unused deposit address.</td>
                <td className="mono">No deposit address is available. Ask the operator to add one.</td>
              </tr>
              <tr>
                <td><span className="pill is-failed">500</span></td>
                <td>The server could not finish the request.</td>
                <td className="mono">Internal server error, or the underlying message</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="docs-note">Amounts are decimal strings, not JSON numbers, so 18-decimal USDT values are not rounded by floating point. A request body is not used. Valid JSON is ignored. Invalid JSON returns 400 before the handler runs.</p>
      </article>

      <article className="card stack">
        <header className="docs-endpoint">
          <span className="method is-post">POST</span>
          <code className="docs-path">{base}/v1/deposits</code>
        </header>
        <h2>Create a deposit address</h2>
        <p className="muted">Assigns one available address to this account and returns it with status <code>waiting</code>. Send the USDT only to <code>deposit.address</code> from this response. Call this endpoint again for the next payment.</p>
        <h3>Request</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Header</th><th>Required</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">X-Api-Key</td>
                <td>Yes</td>
                <td>Your API key. The header name is case-insensitive.</td>
              </tr>
              <tr>
                <td className="mono">Content-Type</td>
                <td>No</td>
                <td>Omit it. There is no body.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="docs-note">Expected payload: none. Do not send amount, address, or callback fields. The amount is read from the chain after the USDT arrives. The split is read from the payout addresses saved in this account.</p>
        <CodeBlock label="cURL" code={createCurl} copied={copied === 'create-curl'} onCopy={() => copyText('create-curl', createCurl)} />
        <h3>Success · 201 Created</h3>
        <CodeBlock label="application/json" code={CREATE_RESPONSE} copied={copied === 'create-body'} onCopy={() => copyText('create-body', CREATE_RESPONSE)} />
        <h3>Errors</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Status</th><th>message</th><th>What to do</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="pill is-failed">401</span></td>
                <td className="mono">API key required</td>
                <td>Send the X-Api-Key header.</td>
              </tr>
              <tr>
                <td><span className="pill is-failed">401</span></td>
                <td className="mono">API key is invalid</td>
                <td>Use the current key from this page. A rotated or inactive key is rejected.</td>
              </tr>
              <tr>
                <td><span className="pill is-warn">400</span></td>
                <td className="mono">Payout addresses are not ready. Active percentages must total 100.</td>
                <td>Save an active split that totals 100%, then call again.</td>
              </tr>
              <tr>
                <td><span className="pill is-warn">503</span></td>
                <td className="mono">No deposit address is available. Ask the operator to add one.</td>
                <td>Wait until the operator adds an address, or until a finished deposit returns one to the pool.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className="card stack">
        <header className="docs-endpoint">
          <span className="method is-get">GET</span>
          <code className="docs-path">{base}/v1/deposits/:id</code>
        </header>
        <h2>Read a deposit</h2>
        <p className="muted">Returns the same deposit object, including the received amount, the charge, and each payout once the split has been planned. The id must belong to the account for this API key. Another account’s id returns 404.</p>
        <h3>Request</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Part</th><th>Required</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono">X-Api-Key</td>
                <td>Yes</td>
                <td>The same key used to create the deposit.</td>
              </tr>
              <tr>
                <td className="mono">:id</td>
                <td>Yes</td>
                <td>deposit.id from the create response. Example: {SAMPLE_ID}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="docs-note">Expected payload: none.</p>
        <CodeBlock label="cURL" code={readCurl} copied={copied === 'read-curl'} onCopy={() => copyText('read-curl', readCurl)} />
        <h3>Success · 200 OK</h3>
        <p className="muted">The sample below is a finished 100 USDT deposit with a 60/40 split. chargeAmount here is an illustration. The live charge is the operator’s flat fee plus their percent of receivedAmount.</p>
        <CodeBlock label="application/json" code={READ_RESPONSE} copied={copied === 'read-body'} onCopy={() => copyText('read-body', READ_RESPONSE)} />
        <h3>Errors</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Status</th><th>message</th><th>What to do</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="pill is-failed">401</span></td>
                <td className="mono">API key required</td>
                <td>Send the X-Api-Key header.</td>
              </tr>
              <tr>
                <td><span className="pill is-failed">401</span></td>
                <td className="mono">API key is invalid</td>
                <td>Use the current key from this page.</td>
              </tr>
              <tr>
                <td><span className="pill is-failed">404</span></td>
                <td className="mono">Deposit not found</td>
                <td>Check the id. A deposit created by another key is hidden.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className="card stack">
        <h2>Deposit object</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Field</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              {DEPOSIT_FIELDS.map(([field, type, meaning]) => (
                <tr key={field}>
                  <td className="mono">{field}</td>
                  <td>{type}</td>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card stack">
        <h2>Deposit status</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>status</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              {DEPOSIT_STATUSES.map(([status, meaning]) => (
                <tr key={status}>
                  <td><span className={`pill is-${status}`}>{status}</span></td>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="docs-note">Charge formula: flat fee + receivedAmount × percent ÷ 100. Both numbers are set by the operator. A zero charge still lets the split run. The charge is debited from the virtual wallet when the split starts, not when the address is created.</p>
      </article>

      <article className="card stack">
        <h2>Payout object</h2>
        <p className="muted">Present after the received USDT is recorded and the charge succeeds. payouts stays empty while status is waiting, and also while status is insufficient_balance.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Field</th><th>Type</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              {PAYOUT_FIELDS.map(([field, type, meaning]) => (
                <tr key={field}>
                  <td className="mono">{field}</td>
                  <td>{type}</td>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>payouts[].status</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="pill is-pending">pending</span></td>
                <td>This share has not been sent yet.</td>
              </tr>
              <tr>
                <td><span className="pill is-completed">completed</span></td>
                <td>This share was transferred. txHash is the BNB Smart Chain transaction.</td>
              </tr>
              <tr>
                <td><span className="pill is-failed">failed</span></td>
                <td>This share did not transfer. The deposit status is also failed.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </motion.section>
  );
}
