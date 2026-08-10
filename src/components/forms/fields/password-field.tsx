import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import type { ComponentProps, ComponentType, Ref } from 'react';

interface PasswordFieldApi {
  name: string;
  state: { value: string; meta: { isTouched: boolean; isValid: boolean } };
  handleChange: (value: string) => void;
  handleBlur: () => void;
  Field: ComponentType<ComponentProps<'div'>>;
  FieldSet: ComponentType<ComponentProps<'fieldset'>>;
  FieldLabel: ComponentType<ComponentProps<'label'>>;
  FieldError: ComponentType<ComponentProps<'p'>>;
}

interface PasswordFieldProps {
  field: PasswordFieldApi;
  show: boolean;
  onToggle: () => void;
  label: string;
  loading?: boolean;
  autoComplete?: string;
  inputRef?: Ref<HTMLInputElement>;
}

export function PasswordField({
  field,
  show,
  onToggle,
  label,
  loading,
  autoComplete,
  inputRef
}: PasswordFieldProps) {
  return (
    <field.FieldSet>
      <field.Field>
        <field.FieldLabel htmlFor='password'>{label}</field.FieldLabel>
        <div className='relative'>
          <Input
            id='password'
            name='password'
            type={show ? 'text' : 'password'}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder='••••••••'
            autoComplete={autoComplete}
            disabled={loading}
            aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            className='pr-10'
            ref={inputRef}
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
