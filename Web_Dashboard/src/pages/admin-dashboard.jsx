import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as FramerMotion from 'framer-motion';
import {
  Activity, CheckCircle, Clock, Eye, EyeOff, KeyRound, Loader2,
  LogOut, RefreshCw, Shield, UserPlus, Users, ClipboardCheck, Trash2,
  UserCheck, LogIn,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import api from '../api';
import { dashboardStyles } from '../components/shared/dashboardStyles';
import { LoadingCard, ErrorCard } from '../components/shared/Cards';

const PW_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'number', label: 'One number', test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const tabs = [
  { id: 'security-logs', label: 'Security Logs', icon: Activity },
  { id: 'sae-accounts', label: 'Add SAE Account', icon: UserPlus },
  { id: 'admin-accounts', label: 'Add Admin Account', icon: Shield },
];

function validatePassword(password) {
  const failed = PW_RULES.filter((rule) => !rule.test(password));
  return { valid: failed.length === 0, failed };
}

function formatReason(reason) {
  return (reason || 'unknown').replace(/_/g, ' ');
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2.5 pr-10 text-white outline-none transition-colors focus:border-teal-500"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((current) => !current)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-teal-300"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SecurityLogs() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [role, setRole] = useState('admin');
  const [section, setSection] = useState('sessions');

  const sections = useMemo(() => [
    { id: 'sessions', label: 'Login & logout', icon: LogIn },
    { id: 'validation', label: 'Data validation', icon: ClipboardCheck },
    { id: 'deletion', label: 'Deletions', icon: Trash2 },
    ...(role === 'admin' ? [{ id: 'lgu_approval', label: 'LGU approvals', icon: UserCheck }] : []),
  ], [role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (section === 'sessions') {
        const data = await api.getLoginLogs(role, 300);
        setRecords((data.logs || []).filter((log) => log.success));
      } else {
        const data = await api.getSecurityEvents(role, section, 300);
        setRecords(data.events || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load security logs.');
    } finally {
      setLoading(false);
    }
  }, [role, section]);

  useEffect(() => { load(); }, [load]);

  const changeRole = (nextRole) => {
    setRole(nextRole);
    setSection('sessions');
  };

  const detailText = (record) => {
    const details = record.details || {};
    if (record.category === 'validation') {
      if (details.old_status || details.new_status) {
        return `${formatReason(details.old_status)} → ${formatReason(details.new_status)}`;
      }
      if (details.new_location) {
        return `${Number(details.new_location.latitude).toFixed(5)}, ${Number(details.new_location.longitude).toFixed(5)}`;
      }
    }
    if (details.email) return details.email;
    if (details.count) return `${details.count} records`;
    return record.resource_id || '-';
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex w-full rounded-xl border border-slate-700 bg-slate-900/70 p-1 sm:w-auto">
        {[{ id: 'admin', label: 'Admin accounts', icon: Shield }, { id: 'lgu', label: 'LGU accounts', icon: Users }].map((option) => {
          const Icon = option.icon;
          return (
            <button key={option.id} type="button" onClick={() => changeRole(option.id)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition duration-200 sm:flex-none ${role === option.id ? 'bg-teal-600 text-white shadow-lg shadow-teal-950/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <Icon className="h-4 w-4" /> {option.label}
            </button>
          );
        })}
      </div>

      <div className="content-card">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white capitalize">{role} security history</h2>
            <p className="mt-1 text-sm text-slate-400">Review account sessions and every sensitive action tied to the account.</p>
          </div>
          <button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-600"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-700/70 pb-4">
          {sections.map((option) => {
            const Icon = option.icon;
            return <button key={option.id} type="button" onClick={() => setSection(option.id)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition duration-200 hover:-translate-y-0.5 ${section === option.id ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-500 hover:text-white'}`}><Icon className="h-4 w-4" />{option.label}</button>;
          })}
        </div>

        {loading ? <LoadingCard /> : error ? <ErrorCard message={error} onRetry={load} /> : records.length === 0 ? (
          <p className="py-10 text-center text-slate-500">No {sections.find((item) => item.id === section)?.label.toLowerCase()} records yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700/60">
            <table className="custom-table min-w-[980px]">
              <thead>{section === 'sessions' ? <tr><th>Account</th><th>Entry time</th><th>Logout time</th><th>Session</th><th>Entry point</th><th>Device</th></tr> : <tr><th>Time</th><th>Account</th><th>Action</th><th>Record</th><th>Details</th><th>Location</th></tr>}</thead>
              <tbody>
                {records.map((record) => section === 'sessions' ? (
                  <tr key={record.id} className="transition-colors hover:bg-teal-500/10">
                    <td className="font-semibold text-white">{record.username || '-'}</td>
                    <td><span className="inline-flex items-center gap-1.5"><LogIn className="h-3.5 w-3.5 text-teal-400" />{record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</span></td>
                    <td>{record.logout_at ? <span className="inline-flex items-center gap-1.5"><LogOut className="h-3.5 w-3.5 text-cyan-400" />{new Date(record.logout_at).toLocaleString()}</span> : '-'}</td>
                    <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.logout_at ? 'bg-slate-500/15 text-slate-300' : 'bg-teal-500/10 text-teal-300'}`}>{record.logout_at ? 'Closed' : 'Active / expired'}</span></td>
                    <td className="text-cyan-300">{record.ip_location || 'Unknown location'}</td>
                    <td className="max-w-xs truncate text-slate-400">{record.user_agent || '-'}</td>
                  </tr>
                ) : (
                  <tr key={record.id} className="transition-colors hover:bg-teal-500/10">
                    <td><span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-500" />{record.created_at ? new Date(record.created_at).toLocaleString() : '-'}</span></td>
                    <td className="font-semibold text-white">{record.actor_name || '-'}</td>
                    <td className="capitalize text-teal-300">{formatReason(record.action)}</td>
                    <td><span className="uppercase text-xs text-slate-400">{formatReason(record.resource_type)}</span><div className="max-w-48 truncate text-slate-300">{record.resource_id || 'Bulk action'}</div></td>
                    <td className="capitalize">{detailText(record)}</td>
                    <td className="text-cyan-300">{record.ip_location || 'Unknown location'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ReauthModal({ open, accountType, pendingForm, onCancel, onConfirm }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const close = (created = false) => {
    setUsername('');
    setPassword('');
    setLoading(false);
    setMessage(null);
    onCancel(created);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setMessage({ type: 'error', text: 'Enter the SAE ID and password to continue.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await onConfirm({ username: username.trim(), password });
      setMessage({ type: 'success', text: `${accountType === 'sae' ? 'SAE' : 'Admin'} account added successfully.` });
      setTimeout(() => {
        close(true);
      }, 1400);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Account creation failed.' });
      setLoading(false);
    }
  };

  return (
    <FramerMotion.AnimatePresence>
      {open && (
        <FramerMotion.motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 px-4 py-10 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <FramerMotion.motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-md rounded-2xl border border-teal-500/25 bg-slate-900/95 p-6 shadow-2xl shadow-black/50"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/15">
                <KeyRound className="h-6 w-6 text-teal-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">SAE Re-login</h2>
                <p className="text-sm text-slate-400">Confirm before adding {pendingForm?.username || 'the new account'}.</p>
              </div>
            </div>

            <FramerMotion.AnimatePresence mode="wait">
              {message?.type === 'success' ? (
                <FramerMotion.motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-5 text-center"
                >
                  <FramerMotion.motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                    className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/20"
                  >
                    <CheckCircle className="h-8 w-8 text-teal-300" />
                  </FramerMotion.motion.div>
                  <p className="font-semibold text-teal-200">{message.text}</p>
                </FramerMotion.motion.div>
              ) : (
                <FramerMotion.motion.form
                  key="form"
                  onSubmit={submit}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="space-y-4"
                >
                  {message?.type === 'error' && (
                    <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      {message.text}
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">SAE ID</label>
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value.replace(/\D/g, ''))}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="w-full rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2.5 text-white outline-none transition-colors focus:border-teal-500"
                      placeholder="Enter SAE ID"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">SAE Password</label>
                    <PasswordInput
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter SAE password"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => close(false)}
                      disabled={loading}
                      className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Confirm
                    </button>
                  </div>
                </FramerMotion.motion.form>
              )}
            </FramerMotion.AnimatePresence>
          </FramerMotion.motion.div>
        </FramerMotion.motion.div>
      )}
    </FramerMotion.AnimatePresence>
  );
}

function AccountCreateContent({ type }) {
  const isSAE = type === 'sae';
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [reauthOpen, setReauthOpen] = useState(false);
  const [message, setMessage] = useState(null);

  const pwValidation = validatePassword(form.password);
  const validSaeId = !isSAE || /^[0-9]+$/.test(form.username.trim());
  const canSubmit =
    form.username.trim() &&
    form.email.trim() &&
    form.password &&
    form.confirmPassword &&
    validSaeId &&
    pwValidation.valid &&
    form.password === form.confirmPassword;

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
  };

  const openReauth = (event) => {
    event.preventDefault();
    if (!pwValidation.valid) {
      setMessage({ type: 'error', text: `Password must include: ${pwValidation.failed.map((rule) => rule.label).join(', ')}.` });
      return;
    }
    if (!validSaeId) {
      setMessage({ type: 'error', text: 'SAE ID must contain numbers only.' });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setMessage(null);
    setReauthOpen(true);
  };

  const createAccount = async ({ username, password }) => {
    const previousSession = localStorage.getItem('user');
    try {
      const saeSession = await api.loginUser(username, password, 'sae');
      if (isSAE) {
        localStorage.setItem('user', JSON.stringify(saeSession));
        await api.createSAEAccount({
          authorizer_username: username,
          authorizer_password: password,
          full_name: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      } else {
        if (previousSession) localStorage.setItem('user', previousSession);
        await api.createAdminAccount({
          full_name: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'admin',
        });
      }
      setForm({ username: '', email: '', password: '', confirmPassword: '' });
    } finally {
      if (previousSession) localStorage.setItem('user', previousSession);
      else localStorage.removeItem('user');
    }
  };

  return (
    <div className="content-card relative">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-teal-500/25 bg-teal-500/15">
          {isSAE ? <Shield className="h-6 w-6 text-teal-300" /> : <UserPlus className="h-6 w-6 text-teal-300" />}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Add {isSAE ? 'SAE' : 'Admin'} Account</h2>
          <p className="mt-1 text-sm text-gray-400">Fill in the new account first. SAE re-login appears after you press add.</p>
        </div>
      </div>

      <form onSubmit={openReauth} className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-gray-400">New {isSAE ? 'SAE ID' : 'Admin Username'}</label>
          <input
            value={form.username}
            onChange={(event) => update('username', isSAE ? event.target.value.replace(/\D/g, '') : event.target.value)}
            inputMode={isSAE ? 'numeric' : undefined}
            pattern={isSAE ? '[0-9]*' : undefined}
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none transition-colors focus:ring-2 focus:ring-teal-500"
            placeholder={isSAE ? 'Numbers only' : 'Admin username'}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">New {isSAE ? 'SAE' : 'Admin'} Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none transition-colors focus:ring-2 focus:ring-teal-500"
            placeholder={isSAE ? 'sae@example.com' : 'admin@example.com'}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">New {isSAE ? 'SAE' : 'Admin'} Password</label>
          <PasswordInput
            value={form.password}
            onChange={(event) => update('password', event.target.value)}
            placeholder="Enter a password"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Confirm New Password</label>
          <PasswordInput
            value={form.confirmPassword}
            onChange={(event) => update('confirmPassword', event.target.value)}
            placeholder="Re-enter password"
          />
        </div>

        <div className="space-y-3 md:col-span-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PW_RULES.map((rule) => {
              const ok = rule.test(form.password);
              return (
                <div key={rule.id} className={`flex items-center gap-2 text-xs ${ok ? 'text-teal-300' : 'text-gray-500'}`}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  {rule.label}
                </div>
              );
            })}
          </div>

          {message && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-teal-500/25 bg-teal-500/10 text-teal-300'
                : 'border-red-500/25 bg-red-500/10 text-red-300'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Add {isSAE ? 'SAE' : 'Admin'} Account
          </button>
        </div>
      </form>

      <ReauthModal
        open={reauthOpen}
        accountType={type}
        pendingForm={form}
        onCancel={(created) => {
          setReauthOpen(false);
          if (created) setMessage(null);
        }}
        onConfirm={createAccount}
      />
    </div>
  );
}

function SAEAccessOverlay({ onUnlock }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Enter an SAE username and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const userData = await api.loginUser(username.trim(), password, 'sae');
      onUnlock(userData);
    } catch (err) {
      setError(err.message || 'SAE access failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-10 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-teal-500/20 bg-slate-900/95 p-6 shadow-2xl shadow-black/50">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/15">
            <Shield className="h-6 w-6 text-teal-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">SAE Login</h1>
            <p className="text-sm text-slate-400">Higher access is required for this admin area</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">SAE Username</label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2.5 text-white outline-none transition-colors focus:border-teal-500"
              placeholder="SAE username"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">SAE Password</label>
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="SAE password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {loading ? 'Checking access...' : 'Enter SAE Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

function DashboardShell({ activeTab, setActiveTab, user, returnToDashboard, returnLabel, children }) {
  const active = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-700/80 bg-slate-900/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/roadsense.png" alt="RoadSense" className="h-11 w-11 rounded-full object-cover" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white">SAE Dashboard</h1>
              <p className="text-sm text-slate-400">Security monitoring and SAE account control</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? 'border-teal-400/50 bg-teal-500/15 text-teal-200'
                      : 'border-slate-700 bg-slate-800/70 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {tab.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={returnToDashboard}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20"
            >
              <LogOut className="h-4 w-4" /> {returnLabel}
            </button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-700/70 bg-slate-800/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">{active.label}</p>
            <h2 className="mt-1 text-2xl font-bold text-white">{active.label}</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1.5 text-sm text-slate-300">
            <Users className="h-4 w-4 text-teal-300" />
            {user?.full_name || 'SAE'}
          </div>
        </div>
        {children}
      </main>
    </>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('security-logs');
  const [unlocked, setUnlocked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user'))?.role === 'sae'; }
    catch { return false; }
  });
  const [gateUser, setGateUser] = useState(null);
  const navigate = useNavigate();
  const user = useMemo(() => {
    try { return gateUser || JSON.parse(localStorage.getItem('user')) || {}; }
    catch { return gateUser || {}; }
  }, [gateUser]);

  const hasReturnSession = Boolean(sessionStorage.getItem('roadsense_return_session'));

  const returnToDashboard = async () => {
    try { await api.logoutUser(); } catch { /* Local session cleanup must still run. */ }
    const previous = sessionStorage.getItem('roadsense_return_session');
    sessionStorage.removeItem('roadsense_return_session');
    if (previous) {
      localStorage.setItem('user', previous);
      navigate('/dashboard', { replace: true });
    } else {
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    }
  };

  return (
    <>
      <style>{dashboardStyles}</style>
      <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-200">
        <div className="shape-1" /><div className="shape-2" />
        <div className={unlocked ? '' : 'pointer-events-none select-none blur-sm'}>
          <DashboardShell activeTab={activeTab} setActiveTab={setActiveTab} user={user} returnToDashboard={returnToDashboard} returnLabel={hasReturnSession ? 'Return to Dashboard' : 'Log out'}>
            {activeTab === 'security-logs' && <SecurityLogs />}
            {activeTab === 'sae-accounts' && <AccountCreateContent type="sae" />}
            {activeTab === 'admin-accounts' && <AccountCreateContent type="admin" />}
          </DashboardShell>
        </div>
        {!unlocked && (
          <SAEAccessOverlay onUnlock={(nextUser) => {
            const previous = localStorage.getItem('user');
            if (previous) sessionStorage.setItem('roadsense_return_session', previous);
            localStorage.setItem('user', JSON.stringify(nextUser));
            setGateUser(nextUser);
            setUnlocked(true);
          }} />
        )}
      </div>
    </>
  );
}
