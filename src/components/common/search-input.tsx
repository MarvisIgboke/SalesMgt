import { useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn, debounce } from '@/lib/utils'

interface SearchInputProps {
  placeholder?: string
  defaultValue?: string
  onSearch: (value: string) => void
  className?: string
}

export function SearchInput({
  placeholder = 'Search…',
  defaultValue = '',
  onSearch,
  className,
}: SearchInputProps) {
  const debounced = useRef(debounce((value: string) => onSearch(value), 350))

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="pl-9"
        onChange={(e) => debounced.current(e.target.value)}
      />
    </div>
  )
}