export function totalSprintsInYear(quarters) {
  return quarters.reduce((sum, q) => sum + (q.sprintCount || 0), 0);
}

export function absToQS(absSprint, quarters) {
  let cursor = 0;
  for (const q of quarters) {
    const start = cursor + 1;
    const end = cursor + q.sprintCount;
    if (absSprint >= start && absSprint <= end) {
      return {
        quarter: q,
        sprint: absSprint - cursor,
        color: q.color
      };
    }
    cursor += q.sprintCount;
  }
  return null;
}

export function qsToAbs(quarterId, sprintInQuarter, quarters) {
  let cursor = 0;
  for (const q of quarters) {
    if (q.id === quarterId) {
      return cursor + sprintInQuarter;
    }
    cursor += q.sprintCount;
  }
  return null;
}

export function sprintDates(absSprint, calendar) {
  const start = new Date(calendar.yearStart);
  const offsetDays = (absSprint - 1) * calendar.sprintLengthWeeks * 7;
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + calendar.sprintLengthWeeks * 7 - 1);
  return { start, end };
}

export function formatSprintRange(absSprint, calendar) {
  const { start, end } = sprintDates(absSprint, calendar);
  const fmt = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}
