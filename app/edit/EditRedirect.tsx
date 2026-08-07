"use client";

import { useEffect } from "react";

export default function EditRedirect() {
  useEffect(() => {
    window.location.replace("/?edit=1");
  }, []);

  return (
    <main className="auth-gate">
      <div className="auth-gate__card">
        <span className="eyebrow">Modo editorial</span>
        <h1>Abrindo o editor…</h1>
        <p>Você será levado ao site com as ferramentas de edição ativadas.</p>
      </div>
    </main>
  );
}
