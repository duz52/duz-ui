/**
 * Input OTP example for the radix tree — hand-written because the
 * bases' usage differs here: Radix names the length `maxLength` and slots carry `index`.
 */

import * as React from "react"

import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/radix/ui/input-otp"
import { Label } from "@/components/radix/ui/label"

export function Preview(): React.JSX.Element {
  const [value, setValue] = React.useState<string>("")
  return (
    <div className="space-y-1.5">
      <Label htmlFor="preview-input-otp">Verification code</Label>
      <InputOTP
        id="preview-input-otp"
        maxLength={6}
        value={value}
        onChange={setValue}
        agent={{ id: "preview-input-otp", label: "Preview input otp" }}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  )
}

export const usage = `<InputOTP
  maxLength={6}
  value={code}
  onChange={setCode}
  agent={{ id: "verification-code", label: "Verification code" }}
>
  <InputOTPGroup>
    <InputOTPSlot index={0} />
    <InputOTPSlot index={1} />
    <InputOTPSlot index={2} />
  </InputOTPGroup>
  <InputOTPSeparator />
  <InputOTPGroup>
    <InputOTPSlot index={3} />
    <InputOTPSlot index={4} />
    <InputOTPSlot index={5} />
  </InputOTPGroup>
</InputOTP>`
