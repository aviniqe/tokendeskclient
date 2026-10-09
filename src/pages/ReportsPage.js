import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { HiOutlineDocumentDuplicate, HiOutlineDocumentText } from 'react-icons/hi2';
import { getDeposits } from '../services/api';
import Dialog from '../components/Dialog';
import RowMenu from '../components/RowMenu';
import SearchSelect from '../components/SearchSelect';
import { TableSkeleton } from '../components/Skeleton';
import { useRefresh } from '../hooks/useRefresh';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'distributing', label: 'Distributing' },
  { value: 'insufficient_balance', label: 'Needs charge balance' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
];

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0';
  return amount.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function short(value) {
  if (!value) return '';
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function when(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function ReportsPage() {
  const [deposits, setDeposits] = useState([]);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [copied, setCopied] = useState('');

  function applyDeposits(rows) {
    setDeposits(rows);
    setDetail((current) => {
      if (!current) return current;
      return rows.find((row) => row.id === current.id) || current;
    });
  }

  useEffect(() => {
    getDeposits()
      .then((data) => applyDeposits(data.deposits))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    const timer = setInterval(() => {
      getDeposits().then((data) => applyDeposits(data.deposits)).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useRefresh(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDeposits();
      applyDeposits(data.deposits);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  });

  async function copyText(key, value) {
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
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? '' : current)), 1400);
  }

  const visible = status === 'all' ? deposits : deposits.filter((deposit) => deposit.status === status);

  return (
    <motion.section className="stack" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <article className="card card__row">
        <div>
          <h2>Deposit report</h2>
        </div>
        <SearchSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="Filter by status" searchPlaceholder="Search statuses" />
      </article>
      {error && <p className="error">{error}</p>}
      {loading ? <TableSkeleton columns={5} rows={5} /> : (
        <article className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>Charge</th>
                  <th>Payouts</th>
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((deposit, index) => (
                  <tr key={deposit.id}>
                    <td className="col-num">{index + 1}</td>
                    <td className="mono">
                      {deposit.address}
                      {deposit.receivedTxHash && (
                        <div><a href={`https://bscscan.com/tx/${deposit.receivedTxHash}`} target="_blank" rel="noreferrer">In {short(deposit.receivedTxHash)}</a></div>
                      )}
                    </td>
                    <td>
                      <span className={`pill is-${deposit.status}`}>{deposit.status}</span>
                      {deposit.errorMessage && <div className="error">{deposit.errorMessage}</div>}
                    </td>
                    <td>{money(deposit.receivedAmount)}</td>
                    <td>{money(deposit.chargeAmount)}</td>
                    <td>
                      {deposit.payouts.length === 0 && <span className="muted">Waiting</span>}
                      {deposit.payouts.map((payout) => (
                        <div key={payout.id} className="payout-line">
                          <span>{payout.label} · {payout.percent}% · {money(payout.amount)}</span>
                          <span className={`pill is-${payout.status}`}>{payout.status}</span>
                        </div>
                      ))}
                    </td>
                    <td className="col-actions">
                      <RowMenu label="Deposit actions">
                        {(close) => (
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => {
                              close();
                              setCopied('');
                              setDetail(deposit);
                            }}
                          >
                            Details
                          </button>
                        )}
                      </RowMenu>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan="7" className="muted">No deposits for this status.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      )}
      <Dialog
        open={Boolean(detail)}
        title="Deposit details"
        tone="accent"
        icon={HiOutlineDocumentText}
        wide
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <div className="detail-row">
              <span>Status</span>
              <strong><span className={`pill is-${detail.status}`}>{detail.status}</span></strong>
            </div>
            <div className="detail-row">
              <span>When</span>
              <strong>{when(detail.createdAt)}</strong>
            </div>
            <div className="detail-row">
              <span>Received</span>
              <strong>{money(detail.receivedAmount)} USDT</strong>
            </div>
            <div className="detail-row">
              <span>Charge</span>
              <strong>{money(detail.chargeAmount)} USDT</strong>
            </div>
            <div>
              <span className="muted">Deposit id</span>
              <p className="secret-value mono">{detail.id}</p>
            </div>
            <div>
              <span className="muted">Deposit address</span>
              <p className="secret-value mono">{detail.address}</p>
              <button type="button" className="ghost" onClick={() => copyText('address', detail.address)}>
                <HiOutlineDocumentDuplicate />
                {copied === 'address' ? 'Copied' : 'Copy address'}
              </button>
            </div>
            <div>
              <span className="muted">From address</span>
              <p className="secret-value mono">{detail.fromAddress || '—'}</p>
              {detail.fromAddress && (
                <button type="button" className="ghost" onClick={() => copyText('from', detail.fromAddress)}>
                  <HiOutlineDocumentDuplicate />
                  {copied === 'from' ? 'Copied' : 'Copy address'}
                </button>
              )}
            </div>
            <div>
              <span className="muted">Incoming transaction</span>
              {detail.receivedTxHash ? (
                <>
                  <p className="secret-value mono">{detail.receivedTxHash}</p>
                  <div className="actions">
                    <a className="ghost" href={`https://bscscan.com/tx/${detail.receivedTxHash}`} target="_blank" rel="noreferrer">View on BscScan</a>
                    <button type="button" className="ghost" onClick={() => copyText('in-hash', detail.receivedTxHash)}>
                      <HiOutlineDocumentDuplicate />
                      {copied === 'in-hash' ? 'Copied' : 'Copy hash'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="secret-value mono">—</p>
              )}
            </div>
            {detail.errorMessage && <p className="form-alert" role="alert">{detail.errorMessage}</p>}
            <div>
              <span className="muted">Split transactions</span>
              {detail.payouts.length === 0 && <p className="secret-value">No split has been planned yet.</p>}
              {detail.payouts.length > 0 && (
                <div className="stack">
                  {detail.payouts.map((payout, index) => (
                    <article key={payout.id} className="split-card">
                      <div className="detail-row">
                        <strong>{payout.label || `Payout ${index + 1}`}</strong>
                        <span className={`pill is-${payout.status}`}>{payout.status}</span>
                      </div>
                      <div className="detail-row">
                        <span>Percent</span>
                        <strong>{money(payout.percent)}%</strong>
                      </div>
                      <div className="detail-row">
                        <span>Amount</span>
                        <strong>{money(payout.amount)} USDT</strong>
                      </div>
                      <div>
                        <span className="muted">Wallet address</span>
                        <p className="secret-value mono">{payout.toAddress}</p>
                        <button type="button" className="ghost" onClick={() => copyText(`wallet-${payout.id}`, payout.toAddress)}>
                          <HiOutlineDocumentDuplicate />
                          {copied === `wallet-${payout.id}` ? 'Copied' : 'Copy address'}
                        </button>
                      </div>
                      <div>
                        <span className="muted">Transaction hash</span>
                        {payout.txHash ? (
                          <>
                            <p className="secret-value mono">{payout.txHash}</p>
                            <div className="actions">
                              <a className="ghost" href={`https://bscscan.com/tx/${payout.txHash}`} target="_blank" rel="noreferrer">View on BscScan</a>
                              <button type="button" className="ghost" onClick={() => copyText(`hash-${payout.id}`, payout.txHash)}>
                                <HiOutlineDocumentDuplicate />
                                {copied === `hash-${payout.id}` ? 'Copied' : 'Copy hash'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="secret-value mono">—</p>
                        )}
                      </div>
                      {payout.errorMessage && <p className="error">{payout.errorMessage}</p>}
                    </article>
                  ))}
                </div>
              )}
            </div>
            <div className="actions">
              <button type="button" className="primary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </>
        )}
      </Dialog>
    </motion.section>
  );
}
