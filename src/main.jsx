import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { downloadFile } from "./storage.mjs";
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>PMC 暂时无法打开</h1>
        <p>你的本地记录没有被删除。请先保存原始备份，再尝试刷新。</p>
        <button
          onClick={() => {
            downloadFile(localStorage.getItem("pmc.workspace.v1") || "{}", "PMC-原始备份.json");
          }}
        >
          导出原始备份
        </button>
        <p>{this.state.error.message}</p>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <Boundary>
    <App />
  </Boundary>,
);
