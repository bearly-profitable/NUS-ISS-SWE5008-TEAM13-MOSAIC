import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:glass-surface group-[.toaster]:text-foreground/75 group-[.toaster]:rounded-2xl group-[.toaster]:shadow-xl group-[.toaster]:border-white/50",
          description: "group-[.toast]:text-foreground/45",
          actionButton: "group-[.toast]:bg-secondary group-[.toast]:text-white group-[.toast]:rounded-xl group-[.toast]:px-4 group-[.toast]:py-2",
          cancelButton: "group-[.toast]:glass-btn group-[.toast]:text-foreground/55 group-[.toast]:rounded-xl group-[.toast]:px-4 group-[.toast]:py-2",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
