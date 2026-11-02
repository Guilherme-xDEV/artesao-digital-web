import { forwardRef, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string
  erro?: string
}

export const Campo = forwardRef<HTMLInputElement, Props>(function Campo(
  { rotulo, erro, id, ...rest },
  ref,
) {
  const campoId = id ?? rest.name
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={campoId} className="text-sm font-semibold">
        {rotulo}
      </label>
      <input
        ref={ref}
        id={campoId}
        aria-invalid={!!erro}
        className="rounded-xl border border-wood/40 bg-white px-3 py-2.5 outline-none focus:border-taua-red"
        {...rest}
      />
      {erro && <p className="text-sm text-taua-red">{erro}</p>}
    </div>
  )
})
