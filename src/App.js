import { useCallback, useEffect, useState } from 'react';
import { createDeposit, getConfig, getDeposit } from './services/api';
import './App.css';

const STORAGE_KEY = 'tokendesk_deposit_id';

function shortHash(value) {
  if (!value) return '';
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function statusLabel(status) {
  if (status === 'waiting') return 'Waiting for USDT';
  if (status === 'distributing') return 'Splitting payment';
  if (status === 'completed') return 'Split complete';
  if (status === 'failed') return 'Split needs attention';
  return status;
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [deposit, setDeposit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async (id) => {
    const data = await getDeposit(id);
    setDeposit(data.deposit);
    return data.deposit;
  }, []);

  useEffect(() => {
    getConfig().then(setConfig).catch((err) => setError(err.message));
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) refresh(saved).catch(() => sessionStorage.removeItem(STORAGE_KEY));
  }, [refresh]);

  useEffect(() => {
    if (!deposit || deposit.status === 'completed') return undefined;
    const timer = setInterval(() => {
      refresh(deposit.id).catch((err) => setError(err.message));
    }, 8000);
    return () => clearInterval(timer);
  }, [deposit, refresh]);

  async function onRequest() {
    setBusy(true);
    setError('');
    try {
      const data = await createDeposit();
      setDeposit(data.deposit);
      sessionStorage.setItem(STORAGE_KEY, data.deposit.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyAddress() {
    if (!deposit) return;
    try {
      await navigator.clipboard.writeText(deposit.address);
    } catch {
      const input = document.createElement('textarea');
      input.value = deposit.address;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="desk">
      <header className="desk__top">
        <div>
          <p className="desk__kicker">BNB Smart Chain · USDT</p>
          <h1>Token Desk</h1>
        </div>
        <span className={`desk__pill ${config?.payoutReady ? 'is-ready' : ''}`}>
          {config?.payoutReady ? 'Payouts ready' : 'Payouts not configured'}
        </span>
      </header>

      <section className="desk__hero">
        <h2>Request a deposit address. Pay USDT. The same address splits it.</h2>
        <p>
          Each request creates a fresh BEP-20 address. When USDT arrives, that address
          forwards the balance to the configured payout wallets by percentage.
        </p>
        {!deposit && (
          <button type="button" onClick={onRequest} disabled={busy || config?.payoutReady === false}>
            {busy ? 'Creating address…' : 'Get deposit address'}
          </button>
        )}
        {error && <p className="desk__error">{error}</p>}
      </section>

      {deposit && (
        <section className="desk__card">
          <div className="desk__row">
            <span className={`desk__status is-${deposit.status}`}>{statusLabel(deposit.status)}</span>
            <span className="desk__muted">Received {deposit.receivedAmount} USDT</span>
          </div>
          <p className="desk__label">Send USDT (BEP-20) to</p>
          <div className="desk__address">
            <code>{deposit.address}</code>
            <button type="button" onClick={copyAddress}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          {deposit.errorMessage && <p className="desk__error">{deposit.errorMessage}</p>}
          {deposit.payouts.length > 0 && (
            <ul className="desk__splits">
              {deposit.payouts.map((payout) => (
                <li key={payout.id}>
                  <div>
                    <strong>{payout.label}</strong>
                    <span>{payout.percent}%</span>
                  </div>
                  <div>
                    <span>{payout.amount} USDT</span>
                    <span className={`desk__status is-${payout.status}`}>{payout.status}</span>
                  </div>
                  {payout.txHash && (
                    <a href={`https://bscscan.com/tx/${payout.txHash}`} target="_blank" rel="noreferrer">
                      {shortHash(payout.txHash)}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="desk__ghost"
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              setDeposit(null);
              setError('');
            }}
          >
            Request another address
          </button>
        </section>
      )}

      <section className="desk__card">
        <h3>Current split</h3>
        {config?.payouts?.length ? (
          <ul className="desk__plan">
            {config.payouts.map((item) => (
              <li key={`${item.label}-${item.percent}`}>
                <span>{item.label}</span>
                <strong>{item.percent}%</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="desk__muted">An admin still needs to set payout wallets that total 100%.</p>
        )}
      </section>
    </main>
  );
}
