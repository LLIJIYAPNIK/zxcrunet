type SectionHeadProps = {
  id: string;
  label: string;
  title: string;
  titleMuted?: string;
};

export function SectionHead({ id, label, title, titleMuted }: SectionHeadProps) {
  return (
    <div className="mb-10 flex flex-col gap-3 lg:mb-12">
      <span className="label">{label}</span>
      <h2 id={id} className="max-w-[22ch] font-display text-h2 font-medium">
        {title}
        {titleMuted && <span className="text-muted"> {titleMuted}</span>}
      </h2>
    </div>
  );
}
