import { privacyContent } from '@/content/privacy';
import { useDocumentTitle } from '@/lib/use-document-title';

/** `/privacy` (`Requirement: Terms and privacy pages`). */
export function PrivacyPage() {
  useDocumentTitle(privacyContent.title);

  return (
    <article className="mx-auto max-w-2xl px-4 py-16 md:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{privacyContent.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated{' '}
        <time dateTime={privacyContent.lastUpdated}>
          {new Date(privacyContent.lastUpdated).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
      </p>
      <p className="mt-6 text-muted-foreground">{privacyContent.intro}</p>
      <div className="mt-10 flex flex-col gap-8">
        {privacyContent.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            <div className="mt-2 flex flex-col gap-3 text-muted-foreground">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
