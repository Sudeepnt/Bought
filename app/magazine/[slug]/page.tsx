import { notFound } from 'next/navigation';

import { MagazineIssueReader } from '@/components/magazine-issue-reader';
import { getMagazineIssue } from '@/lib/magazine';

export default async function MagazineIssuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const issue = getMagazineIssue(slug);
  if (!issue) notFound();

  return <MagazineIssueReader issue={issue} />;
}
