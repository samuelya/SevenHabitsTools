import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ExerciseList } from './exercise-list';
import { ExerciseListItem, ExerciseListSort, LIST_TOOLS_MIN_ITEMS } from './exercise-list.logic';

const ITEMS: ExerciseListItem[] = [
  { id: 'b', title: 'Begin with the end', subtitle: 'Mission statement', done: false },
  { id: 'a', title: 'Be proactive', done: true },
];

// One more item per letter than `LIST_TOOLS_MIN_ITEMS` requires, so the threshold test can grow
// or shrink the list by slicing it.
const MANY_ITEMS: ExerciseListItem[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({
  id,
  title: `Item ${id}`,
}));

function setUp(
  items: readonly ExerciseListItem[] = ITEMS,
  selectedId: string | null = null,
  noMatchMessage?: string,
  initialSort?: ExerciseListSort,
  deletable?: boolean,
) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('exercise-kit')],
  });
  const fixture = TestBed.createComponent(ExerciseList);
  fixture.componentRef.setInput('items', items);
  fixture.componentRef.setInput('selectedId', selectedId);
  fixture.componentRef.setInput('searchLabel', 'Search items');
  fixture.componentRef.setInput('emptyMessage', 'No items yet.');
  if (noMatchMessage !== undefined) {
    fixture.componentRef.setInput('noMatchMessage', noMatchMessage);
  }
  if (initialSort !== undefined) {
    fixture.componentRef.setInput('initialSort', initialSort);
  }
  if (deletable !== undefined) {
    fixture.componentRef.setInput('deletable', deletable);
  }
  fixture.detectChanges();
  return fixture;
}

function deleteButtons(fixture: { nativeElement: HTMLElement }): HTMLButtonElement[] {
  return [...fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.exercise-list__delete')];
}

function itemButtons(fixture: { nativeElement: HTMLElement }): HTMLButtonElement[] {
  return [...fixture.nativeElement.querySelectorAll<HTMLButtonElement>('mat-nav-list button')];
}

describe('ExerciseList', () => {
  it('renders every item title', () => {
    const fixture = setUp();

    const titles = itemButtons(fixture).map((el) => el.textContent?.trim());
    expect(titles?.some((t) => t?.includes('Begin with the end'))).toBe(true);
    expect(titles?.some((t) => t?.includes('Be proactive'))).toBe(true);
  });

  it('emits select with the clicked item id', () => {
    const fixture = setUp();
    const emitted: string[] = [];
    fixture.componentInstance.itemSelected.subscribe((id) => emitted.push(id));

    // Sorted alphabetically by default: "Be proactive" (a) before "Begin with the end" (b).
    itemButtons(fixture)[0].click();

    expect(emitted).toEqual(['a']);
  });

  it('marks the selected item current', () => {
    const fixture = setUp(ITEMS, 'a');

    const current = fixture.nativeElement.querySelector('button[aria-pressed="true"]');
    expect(current?.textContent).toContain('Be proactive');
    expect(current?.classList).toContain('exercise-list__item--selected');
  });

  it('highlights a warning item, even when it is also done (issue #52)', () => {
    const fixture = setUp([{ id: 'a', title: 'Overdue item', done: true, warning: true }]);

    const row = itemButtons(fixture)[0];
    expect(row.classList).toContain('exercise-list__item--warning');
    expect(row.querySelector('mat-icon')?.textContent?.trim()).toBe('warning');
  });

  it('carries both the selected and warning classes on a row that is both (issue #52)', () => {
    const fixture = setUp(
      [{ id: 'a', title: 'Overdue item', warning: true }],
      'a',
      undefined,
      'none',
    );

    const row = itemButtons(fixture)[0];
    expect(row.classList).toContain('exercise-list__item--selected');
    expect(row.classList).toContain('exercise-list__item--warning');
  });

  it("keeps the given item order for initialSort 'none' (issue #52)", () => {
    const fixture = setUp(ITEMS, null, undefined, 'none');

    // Unsorted: "Begin with the end" (b) stays before "Be proactive" (a), unlike the alphabetical
    // default.
    const titles = itemButtons(fixture).map((el) => el.textContent?.trim());
    expect(titles[0]).toContain('Begin with the end');
    expect(titles[1]).toContain('Be proactive');
  });

  it('filters as the search query changes', () => {
    const fixture = setUp();
    fixture.componentInstance['query'].set('proactive');
    fixture.detectChanges();

    const titles = itemButtons(fixture).map((el) => el.textContent?.trim());
    expect(titles).toHaveLength(1);
    expect(titles[0]).toContain('Be proactive');
  });

  it('renders the emptyMessage input when there are no items', () => {
    const fixture = setUp([]);

    expect(fixture.nativeElement.querySelector('.empty')?.textContent?.trim()).toBe(
      'No items yet.',
    );
  });

  it('renders the noMatchMessage input when items exist but none match the query', () => {
    const fixture = setUp(ITEMS, null, 'Nothing found.');
    fixture.componentInstance['query'].set('zzz');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty')?.textContent?.trim()).toBe(
      'Nothing found.',
    );
    expect(fixture.nativeElement.querySelectorAll('mat-nav-list button')).toHaveLength(0);
  });

  it('falls back to emptyMessage when no noMatchMessage is given', () => {
    const fixture = setUp(ITEMS);
    fixture.componentInstance['query'].set('zzz');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty')?.textContent?.trim()).toBe(
      'No items yet.',
    );
  });

  it('hides search and sort below LIST_TOOLS_MIN_ITEMS', () => {
    const fixture = setUp(MANY_ITEMS.slice(0, LIST_TOOLS_MIN_ITEMS - 1));

    expect(fixture.nativeElement.querySelector('.search')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sort')).toBeNull();
  });

  it('shows search and sort at LIST_TOOLS_MIN_ITEMS', () => {
    const fixture = setUp(MANY_ITEMS.slice(0, LIST_TOOLS_MIN_ITEMS));

    expect(fixture.nativeElement.querySelector('.search')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sort')).not.toBeNull();
  });

  it('renders no bin button when deletable is left at its default (issue #203)', () => {
    const fixture = setUp();

    expect(deleteButtons(fixture)).toHaveLength(0);
  });

  it('renders a bin button per row, named after the item, once deletable is set', () => {
    const fixture = setUp(ITEMS, null, undefined, undefined, true);

    const buttons = deleteButtons(fixture);
    expect(buttons).toHaveLength(2);
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toContain(
      'Delete Be proactive',
    );
  });

  it('shows a blank title as "Untitled", on the row and its bin button (issue #217)', () => {
    const fixture = setUp([{ id: 'blank', title: '  ' }], null, undefined, undefined, true);

    expect(fixture.nativeElement.textContent).toContain('Untitled');
    expect(deleteButtons(fixture)[0].getAttribute('aria-label')).toBe('Delete Untitled');
  });

  it('emits deleteRequested with the item id when its bin button is clicked', () => {
    const fixture = setUp(ITEMS, null, undefined, undefined, true);
    const emitted: string[] = [];
    fixture.componentInstance.deleteRequested.subscribe((id) => emitted.push(id));

    // Sorted alphabetically by default: "Be proactive" (a) before "Begin with the end" (b).
    deleteButtons(fixture)[0].click();

    expect(emitted).toEqual(['a']);
  });

  it("omits a row's own bin button when that item opts out with deletable: false (paradigms-teach)", () => {
    const fixture = setUp(
      [
        { id: 'a', title: 'Has an entry', deletable: true },
        { id: 'b', title: 'No entry yet', deletable: false },
      ],
      null,
      undefined,
      'none',
      true,
    );

    expect(deleteButtons(fixture)).toHaveLength(1);
  });
});
