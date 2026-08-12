import HomeExperience from "./home/HomeExperience";
import { loadPublicSiteContent } from "./site/load-public-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const content = await loadPublicSiteContent();
  return <HomeExperience initialRoute="/" initialContent={content} />;
}
