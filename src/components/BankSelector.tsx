import { useQuery } from '@tanstack/react-query';
import { Building2, Check } from 'lucide-react';
import { adminApi } from '@/api/admin';
import { useSession } from '@/store/session';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function BankSelector() {
  const [open, setOpen] = useState(false);
  const selectedBankId = useSession((s) => s.selectedBankId);
  const setSelectedBankId = useSession((s) => s.setSelectedBankId);

  const { data: banks, isLoading } = useQuery({
    queryKey: ['banks'],
    queryFn: adminApi.listBanks,
  });

  const active = banks?.find((b) => b.recId === selectedBankId);

  if (isLoading) return <Skeleton className="h-9 w-48" />;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-56 justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {active ? (
              <>
                <span className="font-mono text-xs text-muted-foreground">
                  {active.code}
                </span>
                <span className="truncate">{active.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select bank…</span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search banks…" />
          <CommandList>
            <CommandEmpty>No bank found.</CommandEmpty>
            <CommandGroup>
              {banks?.map((b) => (
                <CommandItem
                  key={b.recId}
                  value={`${b.code} ${b.name}`}
                  onSelect={() => {
                    setSelectedBankId(b.recId);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedBankId === b.recId ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono text-xs text-muted-foreground mr-2">
                    {b.code}
                  </span>
                  <span className="truncate">{b.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
