import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';

function TagsField({
  values,
  onPush,
  onRemove
}: {
  values: string[];
  onPush: (val: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [tagInput, setTagInput] = React.useState('');

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !values.includes(tag)) {
      onPush(tag);
      setTagInput('');
    }
  };

  return (
    <>
      <div className='flex gap-2'>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder='Type and press Enter...'
        />
        <Button type='button' variant='secondary' onClick={addTag}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {values.map((tag, idx) => (
            <Badge key={tag} variant='secondary' className='gap-1'>
              {tag}
              <button
                type='button'
                onClick={() => onRemove(idx)}
                className='hover:text-destructive ml-0.5'
              >
                <Icons.close className='h-3 w-3' />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}

export { TagsField };
