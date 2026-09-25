/**
 * components/shared/dashboardStyles.js
 * Shared <style> string injected by all three dashboard layouts.
 */

export const dashboardStyles = `
  .glass-effect {
    background: rgba(30, 41, 59, 0.8);
    backdrop-filter: blur(12px);
    border-right: 1px solid rgba(255,255,255,0.1);
  }
  .nav-link { position: relative; overflow: hidden; }
  .nav-link.active { background: rgba(45,212,191,0.15); color: #5eead4; }
  .nav-link.active::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: #2dd4bf;
  }
  .content-card {
    background: rgba(30,41,59,0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 0.75rem;
    padding: 1.5rem;
    transition: all 0.3s ease;
    min-width: 0;
  }
  .content-card:hover {
    border-color: rgba(45,212,191,0.3);
    box-shadow: 0 0 20px rgba(45,212,191,0.1);
    transform: translateY(-2px);
  }
  .custom-table { width: 100%; border-collapse: collapse; }
  .custom-table th {
    text-align: left;
    padding: 0.75rem;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    color: #94a3b8;
    font-weight: 600;
    font-size: 0.875rem;
  }
  .custom-table td {
    padding: 0.75rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    color: #e2e8f0;
    font-size: 0.875rem;
    vertical-align: middle;
  }
  .custom-table th,
  .custom-table td {
    white-space: nowrap;
  }
  @media (max-width: 768px) {
    .content-card {
      padding: 1rem;
      border-radius: 0.5rem;
    }
    .content-card:hover {
      transform: none;
    }
    .custom-table th,
    .custom-table td {
      padding: 0.625rem;
      font-size: 0.8125rem;
    }
    .nav-link.active::before {
      width: 100%;
      height: 2px;
      top: auto;
      right: 0;
    }
  }
  .shape-1 {
    position: fixed;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(45,212,191,0.15) 0%, transparent 70%);
    border-radius: 50%;
    top: -100px; right: -100px;
    pointer-events: none;
    animation: float 20s infinite ease-in-out;
  }
  .shape-2 {
    position: fixed;
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%);
    border-radius: 50%;
    bottom: -100px; left: -100px;
    pointer-events: none;
    animation: float 15s infinite ease-in-out reverse;
  }
  @keyframes float {
    0%, 100% { transform: translate(0,0) scale(1); }
    50%       { transform: translate(30px,30px) scale(1.1); }
  }
`;

export const lguShapeStyles = dashboardStyles.replace(
  'rgba(168,85,247,0.15)',
  'rgba(6,182,212,0.15)'
);

export const guestShapeStyles = dashboardStyles
  .replace('rgba(45,212,191,0.15)', 'rgba(45,212,191,0.1)')
  .replace('rgba(168,85,247,0.15)', 'rgba(100,116,139,0.1)');
