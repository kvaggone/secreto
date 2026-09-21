import type { AlertDialogContentProps, AlertDialogDescriptionProps, AlertDialogTitleProps } from '@kobalte/core/alert-dialog';
import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { ComponentProps, ParentProps, ValidComponent } from 'solid-js';
import { cn } from '@/modules/shared/style/cn';
import { AlertDialog as AlertDialogPrimitive } from '@kobalte/core/alert-dialog';
import { splitProps } from 'solid-js';

export const AlertDialog = AlertDialogPrimitive;

type alertDialogContentProps<T extends ValidComponent = 'div'> = ParentProps<AlertDialogContentProps<T> & { class?: string }>;

export function AlertDialogContent<T extends ValidComponent = 'div'>(props: PolymorphicProps<T, alertDialogContentProps<T>>) {
  const [local, rest] = splitProps(props as alertDialogContentProps, ['class', 'children']);

  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/60 data-[expanded]:(animate-in fade-in-0) data-[closed]:(animate-out fade-out-0)" />
      <AlertDialogPrimitive.Content
        class={cn(
          'fixed left-50% top-50% z-50 grid w-[calc(100%-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg data-[expanded]:(animate-in fade-in-0 zoom-in-95) data-[closed]:(animate-out fade-out-0 zoom-out-95)',
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class']);
  return <div class={cn('flex flex-col space-y-2', local.class)} {...rest} />;
}

export function AlertDialogFooter(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class']);
  return <div class={cn('flex flex-col-reverse gap-2 sm:(flex-row justify-end)', local.class)} {...rest} />;
}

type alertDialogTitleProps<T extends ValidComponent = 'h2'> = AlertDialogTitleProps<T> & { class?: string };

export function AlertDialogTitle<T extends ValidComponent = 'h2'>(props: PolymorphicProps<T, alertDialogTitleProps<T>>) {
  const [local, rest] = splitProps(props as alertDialogTitleProps, ['class']);
  return <AlertDialogPrimitive.Title class={cn('text-lg font-semibold', local.class)} {...rest} />;
}

type alertDialogDescriptionProps<T extends ValidComponent = 'p'> = AlertDialogDescriptionProps<T> & { class?: string };

export function AlertDialogDescription<T extends ValidComponent = 'p'>(props: PolymorphicProps<T, alertDialogDescriptionProps<T>>) {
  const [local, rest] = splitProps(props as alertDialogDescriptionProps, ['class']);
  return <AlertDialogPrimitive.Description class={cn('text-sm text-muted-foreground', local.class)} {...rest} />;
}
