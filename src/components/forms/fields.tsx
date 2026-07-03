// React Final Form field adapters for the Admin portal UI kit.
//
// Same pattern as the Cloud app (`cloud/src/components/fields/*`): each
// adapter renders a <Field> and maps the render-prop `input`/`meta` onto the
// plain UI primitives in `src/components/ui.tsx`. Validation errors are shown
// only after the field was touched or a submit failed.
//
// Usage:
//   <Form onSubmit={...} initialValues={...}>
//     {({ handleSubmit }) => (
//       <form onSubmit={handleSubmit}>
//         <TextInputField name="email" label="Email" validate={emailValidator} />
//       </form>
//     )}
//   </Form>

import { InputHTMLAttributes } from 'react';
import { Field } from 'react-final-form';
import { TextField, Toggle, Select, SelectOption } from '@/components/ui';
import type { FieldValidator } from './validators';
import { shouldShowFieldError } from './meta';

// ── Text input ──────────────────────────────────────────────────────
type TextInputFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'name' | 'value' | 'onChange' | 'onBlur' | 'onFocus'
> & {
  name: string;
  label?: string;
  validate?: FieldValidator<string>;
};

export function TextInputField({
  name,
  label,
  validate,
  type = 'text',
  ...rest
}: TextInputFieldProps) {
  return (
    <Field<string>
      name={name}
      validate={validate}
      // Keep '' instead of dropping empty fields from form values, so
      // submit payloads and dirty-checks stay predictable.
      parse={(value) => value}
    >
      {({ input, meta }) => (
        <TextField
          {...rest}
          {...input}
          type={type}
          label={label}
          error={shouldShowFieldError(meta) ? meta.error : undefined}
        />
      )}
    </Field>
  );
}

// ── Toggle (boolean) ────────────────────────────────────────────────
export function ToggleField({
  name,
  label,
  disabled,
}: {
  name: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Field<boolean> name={name} type="checkbox">
      {({ input }) => (
        <Toggle
          checked={!!input.checked}
          onChange={input.onChange}
          disabled={disabled}
          label={label}
        />
      )}
    </Field>
  );
}

// ── Select ──────────────────────────────────────────────────────────
export function SelectField<T extends string = string>({
  name,
  label,
  options,
  placeholder,
  validate,
}: {
  name: string;
  label?: string;
  options: SelectOption<T>[];
  placeholder?: string;
  validate?: FieldValidator<T>;
}) {
  return (
    <Field<T> name={name} validate={validate}>
      {({ input, meta }) => (
        <div className="flex flex-col gap-1">
          <Select<T>
            label={label}
            value={input.value || null}
            options={options}
            onChange={input.onChange}
            placeholder={placeholder}
          />
          {shouldShowFieldError(meta) && (
            <span className="text-xs text-error-fg">{meta.error}</span>
          )}
        </div>
      )}
    </Field>
  );
}
