import React, { useState, useEffect } from 'react';

// Global listener array to allow showToast invocation from anywhere
let toastListeners = [];

export const showToast = (message, type = 'info') => {
  toastListeners.forEach(listener => listener(message, type));
};

export const useToast = () => {
  return showToast;
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleNewToast = (message, type) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      
      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };

    toastListeners.push(handleNewToast);
    return () => {
      toastListeners = toastListeners.filter(l => l !== handleNewToast);
    };
  }, []);

  const handleDismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => handleDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay to trigger entry transition
    const timer = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(timer);
  }, []);

  let borderClass = 'border-l-4 border-[#00E5FF]'; // Cyan default for info
  if (toast.type === 'success') {
    borderClass = 'border-l-4 border-[#3FB950]'; // Green for success
  } else if (toast.type === 'error') {
    borderClass = 'border-l-4 border-[#E24B4A]'; // Red for error
  }

  return (
    <div
      className={`pointer-events-auto p-4 bg-[#10141D]/95 border border-aura-border ${borderClass} rounded shadow-2xl transition-all duration-200 ease-out transform ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      } flex items-center justify-between gap-3 text-xs font-mono text-aura-textLight`}
    >
      <span>{toast.message}</span>
      <button
        onClick={onDismiss}
        className="text-aura-textMuted hover:text-white font-mono text-sm leading-none focus:outline-none"
      >
        ✕
      </button>
    </div>
  );
}
