import { useEffect, useState } from "react";
import { Users, Activity, ShieldCheck, Search, Bell } from "lucide-react";
import "./App.css";
import CustomerIntelligence from "./CustomerIntelligence";
import ChurnPrevention from "./ChurnPrevention";
import { translations } from "./translations";


function App() {
  const [selectedView, setSelectedView] = useState("customer-intelligence");
  const [language, setLanguage] = useState("fr");
  const t = translations[language];
  const [customerData, setCustomerData] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [segmentationData, setSegmentationData] = useState(null);
  const [churnData, setChurnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      try {
        const endpoints = [
          "/data/customer-intelligence.json",
          "/data/customer-activity.json",
          "/data/customer-segmentation.json",
          "/data/churn-analysis.json",
        ];

        const responses = await Promise.all(
          endpoints.map((endpoint) => fetch(endpoint))
        );

        const failedResponse = responses.find((response) => !response.ok);
        if (failedResponse) {
          throw new Error(
            `Backend request failed: ${failedResponse.status} ${failedResponse.url}`
          );
        }

        const [customers, activity, segmentation, churn] = await Promise.all(
          responses.map((response) => response.json())
        );

        if (!cancelled) {
          setCustomerData(customers);
          setActivityData(activity);
          setSegmentationData(segmentation);
          setChurnData(churn);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Backend data could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  const isChurn = selectedView === "churn-prevention";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>SEDAD</strong>
            <span>BANKING INTELLIGENCE</span>
          </div>
        </div>

        <div className="workspace-label">{t.workspaceLabel}</div>
        <div className="workspace">
          <div className="workspace-icon">S</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>Sedad Bank</strong>
            <span style={{ display: "block", color: "#9aa7ba", fontSize: 11 }}>
              Demo environment
            </span>
          </div>
        </div>

        <nav>
          <div className="nav-group">
            <div className="nav-title">{t.customerRetention}</div>
            <button
              className={`nav-item ${!isChurn ? "active" : ""}`}
              onClick={() => setSelectedView("customer-intelligence")}
            >
              <Users size={18} />
              <span>{t.customerIntelligence}</span>
            </button>
            <button
              className={`nav-item ${isChurn ? "active" : ""}`}
              onClick={() => setSelectedView("churn-prevention")}
            >
              <Activity size={18} />
              <span>{t.churnPrevention}</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">SD</div>
            <div>
              <strong>Sedad Demo</strong>
              <span>{t.readOnlyAccess}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            {t.workspace} <span>/</span>
            <strong>Sedad Bank</strong>
          </div>
          <div className="top-actions">
            <div className="language-switch" aria-label="Language selector">
              <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
              <button type="button" className={language === "fr" ? "active" : ""} aria-pressed={language === "fr"} onClick={() => setLanguage("fr")}>FR</button>
            </div>
            <div className="search-box">
              <Search size={16} />
              <span>{t.demoEnvironment}</span>
            </div>
            <div className="icon-button"><Bell size={19} /></div>
            <div className="top-avatar">SD</div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                SEDAD BANK · SYNTHETIC DEMO DATA · READ ONLY
              </div>
              <h1>
                {isChurn ? t.churnPrevention : t.customerIntelligence}
                <span> ✦</span>
              </h1>
              <p>
                {isChurn ? t.churnSubtitle : t.customerSubtitle}
              </p>
            </div>
            <div className="date-button">
              <ShieldCheck size={16} />
              {t.readOnlyDemo}
            </div>
          </section>

          {error && (
            <div className="panel" style={{ padding: 16, color: "#b42318" }}>
              {error}
            </div>
          )}

          {isChurn ? (
            <ChurnPrevention
              churnData={churnData}
              bank="sedad"
              language={language}
              loading={loading}
              error={error}
            />
          ) : (
            <CustomerIntelligence
              customerData={customerData}
              activityData={activityData}
              segmentationData={segmentationData}
              churnData={churnData}
              loading={loading}
              error={error}
              bank="sedad"
              language={language}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
