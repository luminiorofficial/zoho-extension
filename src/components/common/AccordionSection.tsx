import { ChevronDown } from 'lucide-react';

interface AccordionSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function AccordionSection({
  title,
  description,
  children,
  defaultOpen = false,
}: AccordionSectionProps) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 transition hover:bg-slate-50">
        <div>
          <h2 className="font-semibold text-slate-900">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>

        <ChevronDown
          size={20}
          className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>

      <div className="border-t border-slate-100 p-6">
        {children}
      </div>
    </details>
  );
}