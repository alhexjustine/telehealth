import { Link } from 'react-router';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmergencyNotice } from '@/components/emergency-notice';
import { HeroIllustration } from '@/components/illustrations/hero-illustration';
import { LandingIconGlyph } from '@/components/landing-icon';
import { landingContent } from '@/content/landing';
import { useSpecializations } from '@/lib/use-specializations';
import { useDocumentTitle } from '@/lib/use-document-title';

function SectionHeading({
  eyebrow,
  heading,
  intro,
}: {
  eyebrow?: string;
  heading: string;
  intro?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>
      )}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{heading}</h2>
      {intro && <p className="mt-3 text-muted-foreground">{intro}</p>}
    </div>
  );
}

function SpecializationsSection() {
  const specializations = useSpecializations();

  return (
    <section id="specializations" className="scroll-mt-20 px-4 py-16 md:px-6">
      <SectionHeading
        heading={landingContent.specializations.heading}
        intro={landingContent.specializations.intro}
      />
      <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
        {specializations.isPending && (
          <p className="text-sm text-muted-foreground">Loading specializations…</p>
        )}
        {specializations.isError && (
          <p className="text-sm text-muted-foreground">{landingContent.specializations.fallback}</p>
        )}
        {specializations.data?.map((specialization) => (
          <Badge key={specialization.id} variant="secondary" className="px-3 py-1 text-sm">
            {specialization.name}
          </Badge>
        ))}
      </div>
    </section>
  );
}

/** The public landing page at `/` (`Requirement: Landing page content`). */
export function LandingPage() {
  useDocumentTitle('Find care, book a doctor, and get your records');
  const { hero, capabilities, howItWorks, forDoctors, trust, faq } = landingContent;

  return (
    <div>
      {/* 1. Hero */}
      <section className="overflow-hidden px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              {hero.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {hero.headline}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">{hero.subcopy}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={hero.primaryCta.to} className={buttonVariants({ variant: 'default' })}>
                {hero.primaryCta.label}
              </Link>
              <Link to={hero.secondaryCta.to} className={buttonVariants({ variant: 'outline' })}>
                {hero.secondaryCta.label}
              </Link>
            </div>
          </div>
          <HeroIllustration className="mx-auto w-full max-w-md" />
        </div>
      </section>

      {/* 2. Capabilities */}
      <section id="capabilities" className="scroll-mt-20 bg-muted/40 px-4 py-16 md:px-6">
        <SectionHeading heading={capabilities.heading} intro={capabilities.intro} />
        <div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.items.map((item) => (
            <Card key={item.title} className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-3 p-6">
                <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <LandingIconGlyph icon={item.icon} className="size-5" />
                </span>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. How it works */}
      <section id="how-it-works" className="scroll-mt-20 px-4 py-16 md:px-6">
        <SectionHeading heading={howItWorks.heading} intro={howItWorks.intro} />
        <ol className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title} className="flex flex-col items-start gap-3 text-left">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. For doctors */}
      <section id="for-doctors" className="scroll-mt-20 bg-muted/40 px-4 py-16 md:px-6">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {forDoctors.heading}
            </h2>
            <p className="mt-3 text-muted-foreground">{forDoctors.intro}</p>
            <Link
              to="/register/doctor"
              className={buttonVariants({ variant: 'default', className: 'mt-6' })}
            >
              Join as a doctor
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
            {forDoctors.points.map((point) => (
              <div key={point.title} className="flex gap-4 rounded-lg border border-border bg-background p-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <LandingIconGlyph icon={point.icon} className="size-4.5" />
                </span>
                <div>
                  <h3 className="font-semibold">{point.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{point.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Specializations */}
      <SpecializationsSection />

      {/* 6. Trust, privacy, and safety */}
      <section id="trust" className="scroll-mt-20 bg-muted/40 px-4 py-16 md:px-6">
        <SectionHeading heading={trust.heading} intro={trust.intro} />
        <div className="mx-auto mt-8 max-w-2xl">
          <EmergencyNotice />
        </div>
        <div className="mx-auto mt-8 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trust.protections.map((protection) => (
            <div key={protection.title} className="flex gap-3 rounded-lg border border-border bg-background p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LandingIconGlyph icon={protection.icon} className="size-4.5" />
              </span>
              <div>
                <h3 className="font-semibold">{protection.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{protection.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. FAQ */}
      <section id="faq" className="scroll-mt-20 px-4 py-16 md:px-6">
        <SectionHeading heading={faq.heading} />
        <div className="mx-auto mt-8 max-w-2xl">
          <Accordion type="single" collapsible>
            {faq.items.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
}
