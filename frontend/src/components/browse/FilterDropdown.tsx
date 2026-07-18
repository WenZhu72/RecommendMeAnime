"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
  RefObject,
} from "react";

import { ChevronDownIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

const BROWSE_DROPDOWN_OPEN_EVENT = "browse-dropdown-open";
const DROPDOWN_OFFSET_PX = 8;
const VIEWPORT_GUTTER_PX = 20;

export const browseDropdownOptionClasses =
  "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-ink/[0.045] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft";

type UseBrowseDropdownResult = {
  closeDropdown: (restoreFocus?: boolean) => void;
  open: boolean;
  openDropdown: () => void;
  panelId: string;
  rootRef: RefObject<HTMLDivElement | null>;
  triggerId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

export function useBrowseDropdown(): UseBrowseDropdownResult {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const closeDropdown = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openDropdown = useCallback(() => {
    window.dispatchEvent(new CustomEvent(BROWSE_DROPDOWN_OPEN_EVENT, { detail: id }));
    setOpen(true);
  }, [id]);

  useEffect(() => {
    function closeOnOtherDropdown(event: Event) {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    }

    window.addEventListener(BROWSE_DROPDOWN_OPEN_EVENT, closeOnOtherDropdown);
    return () => window.removeEventListener(BROWSE_DROPDOWN_OPEN_EVENT, closeOnOtherDropdown);
  }, [id]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDropdown(true);
    }

    document.addEventListener("mousedown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeDropdown, open]);

  return {
    closeDropdown,
    open,
    openDropdown,
    panelId: `${id}-panel`,
    rootRef,
    triggerId: `${id}-trigger`,
    triggerRef,
  };
}

type BrowseDropdownTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  active: boolean;
  children: ReactNode;
  open: boolean;
};

export const BrowseDropdownTrigger = forwardRef<HTMLButtonElement, BrowseDropdownTriggerProps>(
  function BrowseDropdownTrigger({ active, children, className, open, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "flex min-h-control w-full items-center justify-between gap-2 rounded-control border bg-canvas-soft/90 px-3.5 text-sm font-medium transition-[border-color,background-color,box-shadow] duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-55",
          open || active
            ? "border-brand/45 text-ink"
            : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
          className,
        )}
        {...props}
      >
        <span className="min-w-0 truncate">{children}</span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 transition-transform duration-200 ease-product motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
    );
  },
);

type BrowseDropdownPanelProps = HTMLAttributes<HTMLDivElement> & {
  open: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
};

export function BrowseDropdownPanel({
  children,
  className,
  open,
  rootRef,
  style,
  ...props
}: BrowseDropdownPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [alignEnd, setAlignEnd] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number>();

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const root = rootRef.current;
      const panel = panelRef.current;
      if (!root || !panel) return;

      const rootBounds = root.getBoundingClientRect();
      const panelWidth = panel.offsetWidth;
      const availableBelow = window.innerHeight - rootBounds.bottom - DROPDOWN_OFFSET_PX - VIEWPORT_GUTTER_PX;
      const availableAbove = rootBounds.top - DROPDOWN_OFFSET_PX - VIEWPORT_GUTTER_PX;
      const shouldOpenAbove = panel.scrollHeight > availableBelow && availableAbove > availableBelow;

      setAlignEnd(rootBounds.left + panelWidth > window.innerWidth - VIEWPORT_GUTTER_PX);
      setOpenAbove(shouldOpenAbove);
      setMaxHeight(Math.max(0, shouldOpenAbove ? availableAbove : availableBelow));
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, rootRef]);

  const panelPosition = openAbove
    ? { bottom: `calc(100% + ${DROPDOWN_OFFSET_PX}px)`, top: "auto" }
    : { bottom: "auto", top: `calc(100% + ${DROPDOWN_OFFSET_PX}px)` };

  return (
    <div
      ref={panelRef}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "absolute z-30 overflow-y-auto rounded-card border border-line bg-surface shadow-panel",
        "transition-[opacity,transform,visibility] duration-200 ease-product will-change-[opacity,transform] motion-reduce:transition-none",
        alignEnd ? "right-0" : "left-0",
        openAbove ? "origin-bottom" : "origin-top",
        open
          ? "visible translate-y-0 scale-100 opacity-100"
          : cn(
              "invisible pointer-events-none scale-[0.98] opacity-0",
              openAbove ? "translate-y-1" : "-translate-y-1",
            ),
        className,
      )}
      style={{ ...style, ...panelPosition, maxHeight }}
      {...props}
    >
      {children}
    </div>
  );
}

export type FilterDropdownOption = {
  label: string;
  value: string;
};

type FilterDropdownProps = {
  disabled?: boolean;
  includePlaceholderOption?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: readonly FilterDropdownOption[];
  placeholder: string;
  value: string;
};

export function FilterDropdown({
  disabled = false,
  includePlaceholderOption = true,
  label,
  onChange,
  options,
  placeholder,
  value,
}: FilterDropdownProps) {
  const {
    closeDropdown,
    open,
    openDropdown,
    panelId,
    rootRef,
    triggerId,
    triggerRef,
  } = useBrowseDropdown();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuOptions = useMemo(
    () => includePlaceholderOption ? [{ label: placeholder, value: "" }, ...options] : [...options],
    [includePlaceholderOption, options, placeholder],
  );
  const selectedIndex = Math.max(0, menuOptions.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selectedOption = menuOptions.find((option) => option.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  useEffect(() => {
    if (disabled && open) closeDropdown();
  }, [closeDropdown, disabled, open]);

  useLayoutEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  function showMenu(index = selectedIndex) {
    setActiveIndex(index);
    openDropdown();
  }

  function selectOption(nextValue: string) {
    closeDropdown(true);
    if (nextValue !== value) onChange(nextValue);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (open) {
      let nextIndex: number | undefined;

      if (event.key === "ArrowDown") nextIndex = (activeIndex + 1) % menuOptions.length;
      else if (event.key === "ArrowUp") nextIndex = (activeIndex - 1 + menuOptions.length) % menuOptions.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = menuOptions.length - 1;
      else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectOption(menuOptions[activeIndex].value);
        return;
      }

      if (nextIndex === undefined) return;
      event.preventDefault();
      setActiveIndex(nextIndex);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showMenu();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      showMenu(selectedIndex);
    } else if (event.key === "Home") {
      event.preventDefault();
      showMenu(0);
    } else if (event.key === "End") {
      event.preventDefault();
      showMenu(menuOptions.length - 1);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;

    if (event.key === "ArrowDown") nextIndex = (index + 1) % menuOptions.length;
    else if (event.key === "ArrowUp") nextIndex = (index - 1 + menuOptions.length) % menuOptions.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = menuOptions.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(menuOptions[index].value);
      return;
    } else if (event.key === "Tab") {
      closeDropdown();
      return;
    }

    if (nextIndex === undefined) return;
    event.preventDefault();
    setActiveIndex(nextIndex);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <BrowseDropdownTrigger
        ref={triggerRef}
        id={triggerId}
        active={Boolean(value)}
        open={open}
        disabled={disabled}
        aria-label={`${label}: ${displayLabel}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={panelId}
        onClick={() => open ? closeDropdown() : showMenu()}
        onKeyDown={handleTriggerKeyDown}
      >
        {displayLabel}
      </BrowseDropdownTrigger>

      <BrowseDropdownPanel
        id={panelId}
        role="listbox"
        aria-labelledby={triggerId}
        open={open}
        rootRef={rootRef}
        className="w-full min-w-max max-w-[calc(100vw-2.5rem)] p-1.5"
      >
        {menuOptions.map((option, index) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => selectOption(option.value)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                browseDropdownOptionClasses,
                selected && "bg-ink/[0.045] text-ink",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border text-[0.625rem] font-bold",
                  selected
                    ? "border-brand bg-brand text-on-brand"
                    : "border-line-strong text-transparent",
                )}
              >
                {"\u2713"}
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </BrowseDropdownPanel>
    </div>
  );
}
