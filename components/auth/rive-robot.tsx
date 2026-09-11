'use client'

import { useEffect, useRef } from 'react'
import { useRive } from '@rive-app/react-canvas'

interface RiveRobotProps {
  isHandsUp?: boolean
  triggerFail?: number
  triggerSuccess?: number
  className?: string
}

export function RiveRobot({
  isHandsUp = false,
  triggerFail = 0,
  triggerSuccess = 0,
  className = '',
}: RiveRobotProps) {
  const { rive, RiveComponent } = useRive({
    src: '/riv/robot-login.riv',
    stateMachines: 'robot_login_machine',
    autoplay: true,
  })

  const handsUpInput = useRef<any>(null)
  const successInput = useRef<any>(null)
  const failInput = useRef<any>(null)

  useEffect(() => {
    if (!rive) return

    const inputs = rive.stateMachineInputs('robot_login_machine')

    if (!inputs) {
      console.warn('Rive state machine inputs not found')
      return
    }

    handsUpInput.current = inputs.find(
      (input) => input.name === 'is_hands_up'
    )

    successInput.current = inputs.find(
      (input) => input.name === 'success'
    )

    failInput.current = inputs.find(
      (input) => input.name === 'fail'
    )

    console.log('Rive inputs:', {
      is_hands_up: handsUpInput.current,
      success: successInput.current,
      fail: failInput.current,
    })
  }, [rive])

  // Password field focus
  useEffect(() => {
    if (!handsUpInput.current) return

    handsUpInput.current.value = isHandsUp
  }, [isHandsUp])

  // Successful login
  useEffect(() => {
    if (!successInput.current || triggerSuccess === 0) return

    successInput.current.fire()
  }, [triggerSuccess])

  // Failed login
  useEffect(() => {
    if (!failInput.current || triggerFail === 0) return

    failInput.current.fire()
  }, [triggerFail])

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
    >
      <RiveComponent className="w-full h-full max-w-[440px] max-h-[440px]" />
    </div>
  )
}

