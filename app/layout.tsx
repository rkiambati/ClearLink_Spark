import "./globals.css";

export const metadata = {
  title: "ClearLink",
  description: "Closed-loop patient transport coordination",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="spark-shell">
          <div className="spark-shape one" />
          <div className="spark-shape two" />
          <div className="spark-shape three" />

          <header className="spark-topbar">
            <div className="spark-topbar-inner">
              <div className="spark-brand">
                <div className="spark-logo" aria-hidden="true" />
                <div>
                  <div className="spark-brand-name">ClearLink</div>
                  <div className="spark-brand-tag">
                    Closed-loop transport coordination
                  </div>
                </div>
              </div>

              <div className="spark-actions">
                <a className="spark-btn" href="/login">
                  Login
                </a>
                <a className="spark-btn-primary" href="/staff/dashboard">
                  Dashboard
                </a>
              </div>
            </div>
          </header>

          <main className="spark-container">{children}</main>
        </div>
      </body>
    </html>
  );
}
