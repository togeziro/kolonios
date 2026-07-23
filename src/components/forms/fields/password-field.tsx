import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';

interface PasswordFieldProps {
  field: any;
  show: boolean;
  onToggle: () => void;
  label: string;
  loading?: boolean;
  autoComplete?: string;
}

export function PasswordField({
  field,
  show,
  onToggle,
  label,
  loading,
  autoComplete
}: PasswordFieldProps) {
  return (
    <field.FieldSet>
      <field.Field>
        <field.FieldLabel htmlFor={field.name}>{label}</field.FieldLabel>
        <div className='relative'>
          <Input
            id={field.name}
            name={field.name}
            type={show ? 'text' : 'password'}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder='••••••••'
            autoComplete={autoComplete}
            disabled={loading}
            aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            className='pr-10'
          />
          <button
            type='button'
            onClick={onToggle}
            className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
            tabIndex={-1}
          >
            {show ? <Icons.eyeOff className='h-4 w-4' /> : <Icons.eye className='h-4 w-4' />}
          </button>
        </div>
      </field.Field>
      <field.FieldError />
    </field.FieldSet>
  );
}
