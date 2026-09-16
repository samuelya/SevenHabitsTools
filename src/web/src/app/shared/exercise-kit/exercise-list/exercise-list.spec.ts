import { TestBed } from '@angular/core/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ExerciseList } from './exercise-list';
import { ExerciseListItem } from './exercise-list.logic';

const ITEMS: ExerciseListItem[] = [
  { id: 'b', title: 'Begin with the end', subtitle: 'Mission statement', done: false },
  { id: 'a', title: 'Be proactive', done: true },
];

function setUp(selectedId: string | null = null) {
  TestBed.configureTestingModule({
    providers: [provideTranslocoTesting(), provideTranslocoScope('exercise-kit')],
  });
  const fixture = TestBed.createComponent(ExerciseList);
  fixture.componentRef.setInput('items', ITEMS);
  fixture.componentRef.setInput('selectedId', selectedId);
  fixture.detectChanges();
  return fixture;
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
    const fixture = setUp('a');

    const current = fixture.nativeElement.querySelector('button[aria-selected="true"]');
    expect(current?.textContent).toContain('Be proactive');
  });

  it('filters as the search query changes', () => {
    const fixture = setUp();
    fixture.componentInstance['query'].set('proactive');
    fixture.detectChanges();

    const titles = itemButtons(fixture).map((el) => el.textContent?.trim());
    expect(titles).toHaveLength(1);
    expect(titles[0]).toContain('Be proactive');
  });

  it('shows the empty state when nothing matches', () => {
    const fixture = setUp();
    fixture.componentInstance['query'].set('zzz');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('mat-nav-list button')).toHaveLength(0);
  });
});
