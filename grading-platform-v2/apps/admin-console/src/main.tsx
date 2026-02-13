import React from "react";
import ReactDOM from "react-dom/client";

const App = () => {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>Admin Console V2</h1>
      <p>Placeholder app for phase-0 monorepo bootstrap.</p>
    </main>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
