import { resolveScopeIdentity } from "@ai-grading/domain-core";

const App = () => {
  const identity = resolveScopeIdentity({
    deviceId: "local-dev-device"
  });

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>Extension App V2</h1>
      <p>Monorepo scaffold is ready.</p>
      <pre>{JSON.stringify(identity, null, 2)}</pre>
    </main>
  );
};

export default App;
