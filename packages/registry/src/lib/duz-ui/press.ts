/**
 * The one place that knows how a press is spelled.
 *
 * A press is what a primary-button mouse press performs, in order: focus,
 * then pointerdown, mousedown, pointerup, mouseup, click. Every component
 * that presses something on an agent's behalf goes through this function,
 * so no component has to guess how the sequence is spelled and no two
 * components can disagree.
 *
 * A bare `element.click()` is not a press: it dispatches a single click
 * event, and handlers listening for the press itself — Radix opens its
 * menus on `pointerdown` — never see anything, so a press reported as
 * success would have done nothing. The sequence below already ends in a
 * click event, which is why this function must not also call
 * `element.click()`: firing both would run the click handler twice.
 */

export function pressElement(element: HTMLElement): void {
  // A real press moves focus, and some handlers depend on it.
  element.focus()

  // PointerEvent does not exist in every environment these components are
  // tested in. When it is undefined, dispatch a MouseEvent for the two
  // pointer event types instead: a handler listening for `pointerdown`
  // will not fire there, and that is a limitation of the environment, not
  // something to fake.
  const PointerEventConstructor =
    typeof PointerEvent === "function"
      ? PointerEvent
      : (MouseEvent as unknown as typeof PointerEvent)

  const pointerInit = (buttons: number): PointerEventInit => ({
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons,
    isPrimary: true,
    pointerType: "mouse",
  })

  const mouseInit = (buttons: number): MouseEventInit => ({
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons,
  })

  element.dispatchEvent(new PointerEventConstructor("pointerdown", pointerInit(1)))
  element.dispatchEvent(new MouseEvent("mousedown", mouseInit(1)))
  element.dispatchEvent(new PointerEventConstructor("pointerup", pointerInit(0)))
  element.dispatchEvent(new MouseEvent("mouseup", mouseInit(0)))
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
}
