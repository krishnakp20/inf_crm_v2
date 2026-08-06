import { useState, type InputHTMLAttributes } from "react";

export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className ?? ""} block pr-9`} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3l18 18" strokeLinecap="round" />
            <path
              d="M10.6 5.1A10.7 10.7 0 0 1 12 5c5.5 0 9.3 4.2 10.5 7-0.4 1-1.2 2.3-2.4 3.5M6.6 6.6C4.4 8 2.9 10 2 12c1.2 2.8 5 7 10 7 1.3 0 2.5-.3 3.6-.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M9.9 10a3 3 0 0 0 4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="M2 12c1.2-2.8 5-7 10-7s8.8 4.2 10 7c-1.2 2.8-5 7-10 7s-8.8-4.2-10-7z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
