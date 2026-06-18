// UI primitives for the Norbix Admin Portal.
//
// Built on Headless UI (@headlessui/react, MIT) for accessible behavior
// (focus management, keyboard nav, ARIA, transitions) and styled entirely via
// the CSS design tokens in src/styles.css (mapped to Tailwind utilities in
// tailwind.config.cjs). Nothing here is copied from Tailwind UI / Catalyst
// (a paid product) — only the open-source Tailwind CSS + Headless UI are used,
// so the repository is safe to open source under MIT.
//
// Because every color/radius/font flows from tokens, a downstream developer
// re-skins the whole portal by overriding the --admin-* CSS variables — no
// edits here. See docs/theming.md.

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import {
  Switch,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Dialog,
  DialogPanel,
  DialogTitle,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Field,
  Label,
} from '@headlessui/react';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ── Button ──────────────────────────────────────────────────────────
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
};

export function Button({
  variant = 'primary',
  block,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center rounded-token px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        block && 'w-full',
        variant === 'primary' && 'bg-brand text-brand-fg hover:bg-brand-hover',
        variant === 'secondary' &&
          'bg-surface text-fg ring-1 ring-inset ring-border-token hover:bg-app',
        variant === 'ghost' && 'text-fg-muted hover:bg-app',
        variant === 'danger' && 'bg-danger text-danger-fg hover:opacity-90',
        className,
      )}
      {...rest}
    />
  );
}

// ── Text field ──────────────────────────────────────────────────────
type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function TextField({
  label,
  error,
  className,
  id,
  ...rest
}: FieldProps) {
  const fieldId = id ?? rest.name;
  return (
    <Field className="flex flex-col gap-1">
      {label && (
        <Label htmlFor={fieldId} className="text-sm font-medium text-fg">
          {label}
        </Label>
      )}
      <input
        id={fieldId}
        className={cx(
          'rounded-token border border-border-token bg-surface px-3 py-2 text-sm text-fg shadow-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none',
          error && 'border-danger',
          className,
        )}
        {...rest}
      />
      {error && <span className="text-xs text-error-fg">{error}</span>}
    </Field>
  );
}

// ── Select (Headless UI Listbox) ────────────────────────────────────
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

export function Select<T extends string = string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: {
  label?: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <Field className="flex flex-col gap-1">
      {label && <Label className="text-sm font-medium text-fg">{label}</Label>}
      <Listbox value={value ?? undefined} onChange={onChange}>
        <div className="relative">
          <ListboxButton className="flex w-full items-center justify-between rounded-token border border-border-token bg-surface px-3 py-2 text-left text-sm text-fg shadow-sm focus:border-brand focus:outline-none focus-visible:ring-1 focus-visible:ring-brand">
            <span className={selected ? '' : 'text-fg-subtle'}>
              {selected ? selected.label : placeholder}
            </span>
            <span aria-hidden className="ml-2 text-fg-subtle">
              ▾
            </span>
          </ListboxButton>
          <ListboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-token border border-border-token bg-surface py-1 text-sm shadow-lg focus:outline-none">
            {options.map((o) => (
              <ListboxOption
                key={o.value}
                value={o.value}
                className="cursor-pointer px-3 py-2 text-fg data-[focus]:bg-app data-[selected]:font-medium data-[selected]:text-brand"
              >
                {o.label}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
    </Field>
  );
}

// ── Toggle (Headless UI Switch) ─────────────────────────────────────
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Field className="flex items-center gap-3">
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={cx(
          'relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50',
          'data-[checked]:bg-brand bg-border-token',
        )}
      >
        <span className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white transition data-[checked]:translate-x-6" />
      </Switch>
      {label && <Label className="text-sm text-fg">{label}</Label>}
    </Field>
  );
}

// ── Modal / ConfirmDialog (Headless UI Dialog) ──────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-token-lg bg-surface p-6 shadow-xl">
          {title && (
            <DialogTitle className="mb-3 text-lg font-medium text-fg">
              {title}
            </DialogTitle>
          )}
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {body && <div className="mb-5 text-sm text-fg-muted">{body}</div>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

// ── Dropdown menu (Headless UI Menu) ────────────────────────────────
export interface MenuAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

export function DropdownMenu({
  trigger,
  actions,
  align = 'left',
}: {
  trigger: ReactNode;
  actions: MenuAction[];
  align?: 'left' | 'right';
}) {
  return (
    <Menu as="div" className="relative">
      <MenuButton className="w-full focus:outline-none">{trigger}</MenuButton>
      <MenuItems
        className={cx(
          'absolute z-10 mt-1 min-w-48 rounded-token border border-border-token bg-surface py-1 shadow-lg focus:outline-none',
          align === 'right' ? 'right-0' : 'left-0',
        )}
      >
        {actions.map((a) => (
          <MenuItem key={a.label}>
            <button
              onClick={a.onSelect}
              className={cx(
                'block w-full px-3 py-2 text-left text-sm data-[focus]:bg-app',
                a.danger ? 'text-error-fg' : 'text-fg',
              )}
            >
              {a.label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'rounded-token-lg border border-border-token bg-surface p-6 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-fg">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
    </div>
  );
}

export function Alert({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'success' | 'error';
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        'rounded-token px-4 py-3 text-sm',
        kind === 'info' && 'bg-info-bg text-info-fg',
        kind === 'success' && 'bg-success-bg text-success-fg',
        kind === 'error' && 'bg-error-bg text-error-fg',
      )}
    >
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-fg-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      {label}
    </div>
  );
}
