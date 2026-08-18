interface HeadingProps {
  title: string;
  description: string;
}

export function Heading({ title, description }: HeadingProps) {
  return (
    <div className='min-w-0'>
      <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>{title}</h1>
      <p className='text-muted-foreground max-w-[65ch] text-sm leading-relaxed'>{description}</p>
    </div>
  );
}
