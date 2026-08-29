/**
 * Input OTP example for the base tree — hand-written because the
 * bases' usage differs here: Base UI names the length `length`; each slot is a real `<input>`.
 */

import * as React from "react"

import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/base/ui/input-otp"
import { Label } from "@/components/base/ui/label"

export function Preview(): React.JSX.Element {
  const [value, setValue] = React.useState<string>("")
  return (
    <div className="space-y-1.5">
      <Label htmlFor="preview-input-otp">Verification code</Label>
      <InputOTP
        id="preview-input-otp"
        length={6}
        value={value}
        onValueChange={setValue}
        agent={{ id: "preview-input-otp", label: "Preview input otp" }}
      >
        <InputOTPGroup>
          <InputOTPSlot />
          <InputOTPSlot />
          <InputOTPSlot />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot />
          <InputOTPSlot />
          <InputOTPSlot />
        </InputOTPGroup>
      </InputOTP>
    </div>
  )
}

export const usage = `<InputOTP
  length={6}
  value={code}
  onValueChange={setCode}
  agent={{ id: "verification-code", label: "Verification code" }}
>
  <InputOTPGroup>
    <InputOTPSlot />
    <InputOTPSlot />
    <InputOTPSlot />
  </InputOTPGroup>
  <InputOTPSeparator />
  <InputOTPGroup>
    <InputOTPSlot />
    <InputOTPSlot />
    <InputOTPSlot />
  </InputOTPGroup>
</InputOTP>`
