import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { House, MoreVertical } from 'lucide-react';

import { db } from '@/db/dexie';
import { formatDisplayAddress } from '@/lib/address';
import { formatRelativeTimeNl } from '@/lib/relativeTime';
import type { Photo, Property } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  property: Property;
  lineCount: number;
  onDuplicate: () => void;
  onDelete: () => void;
}

function linesLabel(count: number): string {
  if (count === 0) return 'Geen leidingen';
  if (count === 1) return '1 leiding';
  return `${count} leidingen`;
}

export default function PropertyTile({
  property,
  lineCount,
  onDuplicate,
  onDelete,
}: Props) {
  // Each tile resolves its own cover photo. At this scale (dozens to
  // hundreds of tiles) the extra per-tile subscription is cheap and
  // keeps the component self-sufficient. See CLAUDE.md for the ~100
  // property perf note.
  const coverPhoto = useLiveQuery<Photo | null, null>(
    async () => {
      if (!property.coverPhotoId) return null;
      return (await db.photos.get(property.coverPhotoId)) ?? null;
    },
    [property.coverPhotoId],
    null,
  );

  // Object URL lifecycle — useMemo creates it during render; cleanup
  // effect only revokes on change / unmount. No setState-in-effect.
  const coverUrl = useMemo(
    () => (coverPhoto ? URL.createObjectURL(coverPhoto.thumbnailBlob) : null),
    [coverPhoto],
  );
  useEffect(() => {
    if (!coverUrl) return;
    return () => URL.revokeObjectURL(coverUrl);
  }, [coverUrl]);

  const addressLabel = formatDisplayAddress(property);
  const relativeUpdated = formatRelativeTimeNl(property.updatedAt);

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <Link
        to={`/property/${property.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${addressLabel} openen`}
      >
        <div className="relative aspect-[16/9] w-full bg-muted text-muted-foreground">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <House className="h-10 w-10" strokeWidth={1.25} aria-hidden />
            </div>
          )}
        </div>
        <CardContent className="flex flex-col gap-1 p-4">
          <h3 className="truncate text-base font-semibold text-foreground">
            {addressLabel}
          </h3>
          <p className="text-sm text-muted-foreground">{linesLabel(lineCount)}</p>
          {relativeUpdated && (
            <p className="text-sm text-muted-foreground">
              bijgewerkt {relativeUpdated.toLowerCase()}
            </p>
          )}
        </CardContent>
      </Link>

      {/*
        The DropdownMenu trigger sits on top of the Link. Radix handles
        the click so it doesn't propagate up as a Link navigation. Icon
        size 4 + button size 'icon' is the established chrome scale.
      */}
      <div className="absolute right-2 top-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 shadow-sm"
              aria-label={`Acties voor ${addressLabel}`}
              onClick={(e) => {
                // Belt-and-braces in case Radix's asChild doesn't fully
                // swallow the click on some browsers — we never want a
                // bubble up into the Link.
                e.stopPropagation();
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onDuplicate}>Dupliceer…</DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onSelect={onDelete}
            >
              Verwijder…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
