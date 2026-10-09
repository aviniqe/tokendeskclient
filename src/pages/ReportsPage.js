import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getDeposits } from '../services/api';
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

export default function ReportsPage() {
  const [deposits, setDeposits] = useState([]);
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDeposits()
      .then((data) => setDeposits(data.deposits))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    const timer = setInterval(() => {
      getDeposits().then((data) => setDeposits(data.deposits)).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useRefresh(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDeposits();
      setDeposits(data.deposits);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  });

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
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan="6" className="muted">No deposits for this status.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </motion.section>
  );
}
