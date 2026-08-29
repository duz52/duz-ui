"use client"

/**
 * Agent UI — Calendar.
 *
 * Binds the day picker to the `date` kind. The contract speaks ISO
 * `YYYY-MM-DD` strings in every mode — never a union — because agents handle
 * unions badly and the action's meaning would drift with the mode (the same
 * reason `select` never grew a `multiple` flag):
 *
 * - `single`: zero or one entry (an empty array clears the selection)
 * - `multiple`: any number of entries
 * - `range`: exactly two entries, start then end
 *
 * react-day-picker works in `Date`, `Date[]` and `{ from, to }`; the
 * conversion happens here at the component boundary, so the capability never
 * sees a `Date`.
 */

import * as React from "react"
import {
  DayPicker,
  dateMatchModifiers,
  getDefaultClassNames,
  type DateRange,
  type DayButton,
  type Locale,
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/radix/ui/button"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useCapability, type AgentProp } from "@/lib/agent-ui/use-capability"
import { agentWithElementId, useAccessibleName } from "@/lib/agent-ui/agent-identity"
import { expectStringArray, rejectState } from "@/lib/agent-ui/validate"
import { useControllableState } from "@/lib/agent-ui/use-controllable-state"

type CalendarMode = "single" | "multiple" | "range"

type CalendarState = {
  mode: CalendarMode
  /** Whether the application forbids an empty selection. */
  required: boolean
  value: string[]
  min: string | null
  max: string | null
}

type CalendarActions = {
  set: { value: string[] }
}

/**
 * The selection shape across all three modes. DayPicker's props are a
 * discriminated union on `mode`; the binding works on this one erased shape
 * and casts it back at the render boundary below.
 */
type CalendarSelection = Date | Date[] | DateRange | undefined

/**
 * The calendar's public props: DayPicker's own discriminated union on
 * `mode`, so application code keeps the ergonomics the picker documents
 * (`onSelect={setDate}` typechecks in every mode) — with one deliberate
 * narrowing: the handler receives the new selection alone. DayPicker's
 * handler also carries the trigger date, modifiers and event; an agent's
 * `set` has none of those, so the callback carries one shape for both
 * paths. A calendar without a mode has no selection at all.
 */
type CalendarPropsBase = Omit<
  React.ComponentProps<typeof DayPicker>,
  "mode" | "required" | "selected" | "onSelect"
> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}

/**
 * Two variants per mode, the way react-day-picker itself splits them: under
 * `required` the selection can never become undefined, so the application's
 * handler is not asked to consider a case that cannot happen — and, on the
 * other side of the same fact, the agent is not allowed to produce it.
 */
type CalendarProps =
  | (CalendarPropsBase & {
      mode?: undefined
      required?: undefined
      selected?: undefined
      onSelect?: undefined
    })
  | (CalendarPropsBase & {
      mode: "single"
      required: true
      selected?: Date | undefined
      onSelect?: (selected: Date) => void
    })
  | (CalendarPropsBase & {
      mode: "single"
      required?: false | undefined
      selected?: Date | undefined
      onSelect?: (selected: Date | undefined) => void
    })
  | (CalendarPropsBase & {
      mode: "multiple"
      required: true
      selected?: Date[] | undefined
      onSelect?: (selected: Date[]) => void
    })
  | (CalendarPropsBase & {
      mode: "multiple"
      required?: false | undefined
      selected?: Date[] | undefined
      onSelect?: (selected: Date[] | undefined) => void
    })
  | (CalendarPropsBase & {
      mode: "range"
      required: true
      selected?: DateRange | undefined
      onSelect?: (selected: DateRange) => void
    })
  | (CalendarPropsBase & {
      mode: "range"
      required?: false | undefined
      selected?: DateRange | undefined
      onSelect?: (selected: DateRange | undefined) => void
    })

/**
 * Local, date-only conversion. `toISOString()` renders UTC and shifts the
 * day for anyone east or west of it; the contract's unit is a calendar day,
 * not an instant, so the parts are read and written in local time.
 */
function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/** Inverse of `toISODate`; null when the text is not a real calendar day. */
function fromISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = match[1]
  const month = match[2]
  const day = match[3]
  if (year === undefined || month === undefined || day === undefined) return null
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  // Round-trip: the constructor silently rolls "2026-02-30" into March.
  return toISODate(date) === value ? date : null
}

/** The selection rendered as the contract's ISO strings. */
function selectionToISO(selection: CalendarSelection): string[] {
  if (selection === undefined) return []
  if (selection instanceof Date) return [toISODate(selection)]
  if (Array.isArray(selection)) return selection.map(toISODate)
  // A range being dragged holds its start alone; `date_set` still requires
  // exactly two entries.
  const days: string[] = []
  if (selection.from) days.push(toISODate(selection.from))
  if (selection.to) days.push(toISODate(selection.to))
  return days
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  mode,
  required,
  selected,
  onSelect,
  startMonth,
  endMonth,
  disabled,
  agent,
  ...props
}: CalendarProps & {
  agent?: AgentProp
}) {
  const defaultClassNames = getDefaultClassNames()

  const elementRef = React.useRef<HTMLDivElement>(null)
  const label = useAccessibleName(elementRef, "Calendar")

  // DayPicker v10 makes `onSelect` the controlled/uncontrolled switch: with a
  // handler the application owns `selected`, without one the picker owns its
  // state and `selected` is only the seed. This primitive's empty selection
  // is `undefined`, so `selected` cannot also carry the controlled/uncontrolled
  // switch the way it does for primitives with a distinct empty value — the
  // switch is passed explicitly instead.
  const [value, setValue] = useControllableState<CalendarSelection>({
    prop: selected,
    defaultProp: selected,
    controlled: onSelect !== undefined,
    // The handler is called with the selection the component's own mode
    // produces; the per-mode handler union cannot see that, so this is the
    // second erase boundary (the render boundary below is the first).
    onChange: onSelect as ((value: CalendarSelection) => void) | undefined,
  })

  // DayPicker enforces the navigation bounds by hiding every day before
  // startOfMonth(startMonth) and after endOfMonth(endMonth), so those are
  // the effective earliest and latest selectable days — not the raw prop
  // dates. A `disabled` matcher is arbitrary (functions are opaque), so it
  // is not mined for bounds; it is enforced directly in `set` below.
  const minDate = startMonth
    ? new Date(startMonth.getFullYear(), startMonth.getMonth(), 1)
    : null
  const maxDate = endMonth
    ? new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 0)
    : null

  useCapability<CalendarState, CalendarActions>({
    // A calendar without a selection mode renders a plain month grid: there
    // is no selection for an agent to read or set, so it opts out entirely.
    agent: mode ? agentWithElementId(agent, props.id) : false,
    kind: "date",
    defaultLabel: label,
    read: () => ({
      // The cast is the registration condition two lines down, which the
      // type cannot see: the capability opts out when no mode is set, so
      // read() never runs without one.
      mode: mode as CalendarMode,
      required: required === true,
      value: selectionToISO(value),
      min: minDate ? toISODate(minDate) : null,
      max: maxDate ? toISODate(maxDate) : null,
    }),
    actions: {
      set(input) {
        const next = expectStringArray(input, "value")
        // Before the per-mode shape checks: whether a selection may be
        // dropped at all is a fact about the whole request, while the length
        // rules are facts about its shape in one mode.
        if (required && next.length === 0) {
          rejectState(
            "This calendar requires a selection and cannot be cleared. Provide at least one date.",
          )
        }
        if (mode === "single" && next.length > 1) {
          rejectState(
            `"value" must have at most 1 entry in single mode. Received ${next.length}.`,
          )
        }
        if (mode === "range" && next.length !== 2) {
          rejectState(
            `"value" must have exactly 2 entries in range mode, start then end. Received ${next.length}.`,
          )
        }
        const days = next.map((entry, index) => {
          const date = fromISODate(entry)
          if (!date) {
            rejectState(
              `Entry at index ${index} ("${entry}") is not a valid calendar date. Use YYYY-MM-DD dates, for example 2026-03-14.`,
            )
          }
          if (minDate && date < minDate) {
            rejectState(
              `Entry at index ${index} (${entry}) is before the earliest selectable date ${toISODate(minDate)}.`,
            )
          }
          if (maxDate && date > maxDate) {
            rejectState(
              `Entry at index ${index} (${entry}) is after the latest selectable date ${toISODate(maxDate)}.`,
            )
          }
          if (disabled && dateMatchModifiers(date, disabled)) {
            rejectState(
              `Entry at index ${index} (${entry}) is disabled by the application and cannot be selected.`,
            )
          }
          return date
        })
        setValue(
          mode === "single"
            ? days[0]
            : mode === "range"
              ? { from: days[0], to: days[1] }
              : days,
        )
      },
    },
  })

  // Annotated, not inferred: the inline components keep DayPicker's
  // contextual prop types.
  const dayPickerComponents: NonNullable<
    React.ComponentProps<typeof DayPicker>["components"]
  > = {
    Root: ({ className: rootClassName, rootRef, ...rootProps }) => {
      return (
        <div
          data-slot="calendar"
          ref={(node) => {
            elementRef.current = node
            if (typeof rootRef === "function") rootRef(node)
            else if (rootRef) rootRef.current = node
          }}
          className={cn(rootClassName)}
          {...rootProps}
        />
      )
    },
    Chevron: ({
      className: chevronClassName,
      orientation,
      ...chevronProps
    }) => {
      if (orientation === "left") {
        return (
          <ChevronLeftIcon
            className={cn("size-4", chevronClassName)}
            {...chevronProps}
          />
        )
      }

      if (orientation === "right") {
        return (
          <ChevronRightIcon
            className={cn("size-4", chevronClassName)}
            {...chevronProps}
          />
        )
      }

      return (
        <ChevronDownIcon
          className={cn("size-4", chevronClassName)}
          {...chevronProps}
        />
      )
    },
    DayButton: (dayButtonProps) => (
      <CalendarDayButton locale={locale} {...dayButtonProps} />
    ),
    WeekNumber: ({ children, ...weekNumberProps }) => {
      return (
        <td {...weekNumberProps}>
          <div className="flex size-(--cell-size) items-center justify-center text-center">
            {children}
          </div>
        </td>
      )
    },
    ...components,
  }

  // The mode union is erased on the binding's side and re-narrowed by
  // DayPicker at runtime; this single cast is that boundary.
  const dayPickerProps = {
    ...props,
    required,
    showOutsideDays,
    className: cn(
      "group/calendar bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
      String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
      String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
      className
    ),
    captionLayout,
    locale,
    formatters: {
      formatMonthDropdown: (date: Date) =>
        date.toLocaleString(locale?.code, { month: "short" }),
      ...formatters,
    },
    classNames: {
      root: cn("w-fit", defaultClassNames.root),
      months: cn(
        "relative flex flex-col gap-4 md:flex-row",
        defaultClassNames.months
      ),
      month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
      nav: cn(
        "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
        defaultClassNames.nav
      ),
      button_previous: cn(
        buttonVariants({ variant: buttonVariant }),
        "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
        defaultClassNames.button_previous
      ),
      button_next: cn(
        buttonVariants({ variant: buttonVariant }),
        "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
        defaultClassNames.button_next
      ),
      month_caption: cn(
        "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
        defaultClassNames.month_caption
      ),
      dropdowns: cn(
        "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
        defaultClassNames.dropdowns
      ),
      dropdown_root: cn(
        "relative rounded-(--cell-radius)",
        defaultClassNames.dropdown_root
      ),
      dropdown: cn(
        "absolute inset-0 bg-popover opacity-0",
        defaultClassNames.dropdown
      ),
      caption_label: cn(
        "font-medium select-none",
        captionLayout === "label"
          ? "text-sm"
          : "flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
        defaultClassNames.caption_label
      ),
      month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
      weekdays: cn("flex", defaultClassNames.weekdays),
      weekday: cn(
        "flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none",
        defaultClassNames.weekday
      ),
      week: cn("mt-2 flex w-full", defaultClassNames.week),
      week_number_header: cn(
        "w-(--cell-size) select-none",
        defaultClassNames.week_number_header
      ),
      week_number: cn(
        "text-[0.8rem] text-muted-foreground select-none",
        defaultClassNames.week_number
      ),
      day: cn(
        "group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
        props.showWeekNumber
          ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)"
          : "[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
        defaultClassNames.day
      ),
      range_start: cn(
        "relative isolate z-0 rounded-l-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted",
        defaultClassNames.range_start
      ),
      range_middle: cn("rounded-none", defaultClassNames.range_middle),
      range_end: cn(
        "relative isolate z-0 rounded-r-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted",
        defaultClassNames.range_end
      ),
      today: cn(
        "rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none",
        defaultClassNames.today
      ),
      outside: cn(
        "text-muted-foreground aria-selected:text-muted-foreground",
        defaultClassNames.outside
      ),
      disabled: cn(
        "text-muted-foreground opacity-50",
        defaultClassNames.disabled
      ),
      hidden: cn("invisible", defaultClassNames.hidden),
      ...classNames,
    },
    components: dayPickerComponents,
    mode,
    selected: value,
    onSelect: setValue,
  } as React.ComponentProps<typeof DayPicker>

  return <DayPicker {...dayPickerProps} />
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
