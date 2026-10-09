import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { HiOutlineDocumentDuplicate, HiOutlineDocumentText, HiOutlineQrCode, HiOutlineReceiptPercent } from 'react-icons/hi2';
import Dialog from '../components/Dialog';
import Field from '../components/Field';
import RowMenu from '../components/RowMenu';
import { FormSkeleton, TableSkeleton } from '../components/Skeleton';
import { useForm } from '../hooks/useForm';
import { useRefresh } from '../hooks/useRefresh';
import { txHash } from '../lib/validators';
import { getWallet, submitTopup } from '../services/api';

const rules = {
  txHash: txHash(),
};

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0';
  return amount.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function WalletPage() {
  const [data, setData] = useState(null);
  const form = useForm({ txHash: '' }, rules);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [confirmHash, setConfirmHash] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailCopied, setDetailCopied] = useState('');
  const [chargesOpen, setChargesOpen] = useState(false);

  async function load() {
    const next = await getWallet();
    setData(next);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useRefresh(async () => {
    setLoading(true);
    setError('');
    try {
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  });

  function onSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!form.validate()) return;
    setConfirmHash(form.values.txHash.trim());
  }

  async function confirmDeposit() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await submitTopup({ txHash: confirmHash });
      form.replace({ txHash: '' });
      setConfirmHash('');
      if (result.topup.status === 'approved') {
        setNotice('Transaction matched the receive wallet. The charge wallet was credited.');
      } else {
        setError(result.topup.errorMessage || 'Rejected. This hash is not a USDT transfer to the receive wallet.');
      }
      await load();
    } catch (err) {
      setError(err.message);
      setConfirmHash('');
    } finally {
      setBusy(false);
    }
  }

  async function copyValue(value) {
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
  }

  async function copyAddress() {
    const address = data?.settings?.platformDepositAddress;
    if (!address) return;
    await copyValue(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  async function copyText(id, value) {
    if (!value) return;
    await copyValue(value);
    setDetailCopied(id);
    setTimeout(() => setDetailCopied(''), 1400);
  }

  if (loading) {
    return (
      <div className="stack">
        <FormSkeleton />
        <TableSkeleton columns={5} rows={4} />
      </div>
    );
  }

  const platform = data?.settings?.platformDepositAddress;
  const chargeRanges = Array.isArray(data?.settings?.chargeRanges) ? data.settings.chargeRanges : [];

  return (
    <motion.section className="stack" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <article className="card deposit">
        <div className="deposit__balance">
          <div>
            <span>Charge balance</span>
            <strong>{money(data?.balance)} <small>USDT</small></strong>
          </div>
          <button type="button" className="ghost" onClick={() => setChargesOpen(true)}>
            <HiOutlineReceiptPercent />
            Show charges
          </button>
        </div>
        {platform ? (
          <div className="deposit__pay">
            <div className="deposit__qr">
              <QRCodeSVG
                value={platform}
                size={188}
                level="M"
                bgColor="#ffffff"
                fgColor="#07111a"
                title="USDT receive address"
              />
            </div>
            <div className="deposit__meta">
              <div className="deposit__pills">
                <span className="pill">USDT</span>
                <span className="pill">BEP-20</span>
                <span className="pill">BNB Smart Chain</span>
              </div>
              <p className="deposit__address mono">{platform}</p>
              <button type="button" className="ghost" onClick={copyAddress}>
                <HiOutlineDocumentDuplicate />
                {copied ? 'Copied' : 'Copy address'}
              </button>
            </div>
          </div>
        ) : <p className="error">The operator has not set a platform deposit address yet.</p>}
        <form className="deposit__form" noValidate onSubmit={onSubmit}>
          <Field name="txHash" label="Transaction hash" error={form.error('txHash')}>
            <input
              value={form.values.txHash}
              onChange={(event) => form.setField('txHash', event.target.value)}
              onBlur={() => form.blur('txHash')}
              placeholder="0x transaction hash"
              spellCheck="false"
            />
          </Field>
          {form.summary && <p className="form-alert" role="alert">{form.summary}</p>}
          {error && <p className="form-alert" role="alert">{error}</p>}
          {notice && <p className="form-alert is-ok">{notice}</p>}
          <div className="actions">
            <button type="submit" className="primary" disabled={busy || !platform}>{busy ? 'Checking…' : 'Submit hash'}</button>
          </div>
        </form>
      </article>
      <Dialog
        open={Boolean(confirmHash)}
        title="Submit this deposit?"
        tone="accent"
        icon={HiOutlineQrCode}
        onClose={() => { if (!busy) setConfirmHash(''); }}
      >
        <p className="secret-value mono">{confirmHash}</p>
        <div className="actions">
          <button type="button" className="ghost" onClick={() => setConfirmHash('')} disabled={busy}>Cancel</button>
          <button type="button" className="primary" onClick={confirmDeposit} disabled={busy}>{busy ? 'Checking…' : 'Submit deposit'}</button>
        </div>
      </Dialog>
      <Dialog
        open={chargesOpen}
        title="Split charges"
        tone="accent"
        icon={HiOutlineReceiptPercent}
        wide
        onClose={() => setChargesOpen(false)}
      >
        {chargeRanges.length === 0 ? (
          <p className="fee-empty">No charge ranges are set. A split is charged 0.</p>
        ) : (
          <div className="table-wrap">
            <table className="fee-table">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Charge</th>
                </tr>
              </thead>
              <tbody>
                {chargeRanges.map((row, index) => (
                  <tr key={`${row.min}-${row.max}-${row.percent}`}>
                    <td className="col-num">{index + 1}</td>
                    <td>{money(row.min)} USDT</td>
                    <td>{money(row.max)} USDT</td>
                    <td><span className="fee-rate">{money(row.percent)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="actions">
          <button type="button" className="primary" aria-label="Close charges" onClick={() => setChargesOpen(false)}>Close</button>
        </div>
      </Dialog>
      <article className="card">
        <h2>Deposits</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>When</th>
                <th>Amount</th>
                <th>Status</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {(data?.topups || []).map((topup, index) => (
                <tr key={topup.id}>
                  <td className="col-num">{index + 1}</td>
                  <td>{new Date(topup.createdAt).toLocaleString()}</td>
                  <td>{topup.onchainAmount == null ? '—' : `${money(topup.onchainAmount)} USDT`}</td>
                  <td><span className={`pill is-${topup.status}`}>{topup.status}</span></td>
                  <td className="col-actions">
                    <RowMenu label="Deposit actions">
                      {(close) => (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            close();
                            setDetailCopied('');
                            setDetail(topup);
                          }}
                        >
                          Details
                        </button>
                      )}
                    </RowMenu>
                  </td>
                </tr>
              ))}
              {(data?.topups || []).length === 0 && (
                <tr><td colSpan="5" className="muted">No deposits yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
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
              <strong>{new Date(detail.createdAt).toLocaleString()}</strong>
            </div>
            <div className="detail-row">
              <span>On-chain amount</span>
              <strong>{detail.onchainAmount == null ? '—' : `${money(detail.onchainAmount)} USDT`}</strong>
            </div>
            <div>
              <span className="muted">Transaction hash</span>
              <p className="secret-value mono">{detail.txHash}</p>
              <button type="button" className="ghost" onClick={() => copyText('hash', detail.txHash)}>
                <HiOutlineDocumentDuplicate />
                {detailCopied === 'hash' ? 'Copied' : 'Copy hash'}
              </button>
            </div>
            <div>
              <span className="muted">Deposit address</span>
              <p className="secret-value mono">{detail.depositAddress || platform || '—'}</p>
              {(detail.depositAddress || platform) && (
                <button type="button" className="ghost" onClick={() => copyText('address', detail.depositAddress || platform)}>
                  <HiOutlineDocumentDuplicate />
                  {detailCopied === 'address' ? 'Copied' : 'Copy address'}
                </button>
              )}
            </div>
            {detail.errorMessage && <p className="form-alert" role="alert">{detail.errorMessage}</p>}
            <div className="actions">
              <button type="button" className="primary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </>
        )}
      </Dialog>
    </motion.section>
  );
}
