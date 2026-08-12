import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeExperience from "../home/HomeExperience";
import { loadPublicSiteContent } from "../site/load-public-content";
import { routeDefinition, routeFromSlug } from "../site/routes";

export const dynamic = "force-dynamic";

type SiteRouteProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateMetadata({ params }: SiteRouteProps): Promise<Metadata> {
  const route = routeFromSlug((await params).slug);
  if (!route || route === "/") return {};
  const definition = routeDefinition(route);
  return {
    title: definition.title,
    description: definition.description,
    openGraph: {
      title: definition.title,
      description: definition.description,
      type: "website",
      locale: "pt_BR",
    },
  };
}

export default async function SiteRoute({ params }: SiteRouteProps) {
  const route = routeFromSlug((await params).slug);
  if (!route || route === "/") notFound();
  const content = await loadPublicSiteContent();
  return <HomeExperience initialRoute={route} initialContent={content} />;
}
