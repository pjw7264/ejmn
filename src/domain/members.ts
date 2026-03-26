import { Member } from "./member.js";
import type { Event } from "./event.js";
import type { MemberDetail, MemberRecord } from "./types.js";

export class Members {
  items: Member[];

  constructor(items: Member[] = []) {
    this.items = items;
  }

  static fromEventMembers(items: Array<Member | MemberRecord>): Members {
    return new Members(items.map((item) => (item instanceof Member ? item : Member.fromRecord(item))));
  }

  sortByAvailability(event: Event): Members {
    const slotCountCache = new Map<string, number>();

    const getSlotCount = (member: Member) => {
      if (!slotCountCache.has(member.name)) {
        slotCountCache.set(member.name, member.getAvailabilitySlotCount(event));
      }

      return slotCountCache.get(member.name)!;
    };

    const sortedItems = [...this.items].sort((left, right) => {
      const slotCountDiff = getSlotCount(left) - getSlotCount(right);

      if (slotCountDiff !== 0) {
        return slotCountDiff;
      }

      return left.name.localeCompare(right.name, "ko-KR");
    });

    return new Members(sortedItems);
  }

  toDetails(): MemberDetail[] {
    return this.items.map((member) => member.toDetail());
  }
}
