import { chatGPTSignInPath, getChatGPTUser, isOwnerUser } from "../chatgpt-auth";
import EditRedirect from "./EditRedirect";

export const dynamic = "force-dynamic";

export default async function EditPage() {
  const user = await getChatGPTUser();

  if (!user) {
    return (
      <main className="auth-gate">
        <div className="auth-gate__card">
          <span className="eyebrow">Área reservada</span>
          <h1>Entre para editar o site.</h1>
          <p>O modo de edição é privado e está disponível apenas para o proprietário.</p>
          <a className="button button-primary" href={chatGPTSignInPath("/edit")}>
            Entrar com ChatGPT
          </a>
          {/* Native navigation is intentional: Vinext's Link integration broke this auth boundary. */}
          <a className="text-link" href="/">Voltar ao site</a>
        </div>
      </main>
    );
  }

  if (!isOwnerUser(user)) {
    return (
      <main className="auth-gate">
        <div className="auth-gate__card">
          <span className="eyebrow">Acesso restrito</span>
          <h1>Este espaço é só do proprietário.</h1>
          <p>A conta conectada não tem permissão para editar este conteúdo.</p>
          {/* Native navigation is intentional: Vinext's Link integration broke this auth boundary. */}
          <a className="text-link" href="/">Voltar ao site</a>
        </div>
      </main>
    );
  }

  return <EditRedirect />;
}
