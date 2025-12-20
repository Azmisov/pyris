import { dateTime, dateTimeParse } from '@grafana/data';

describe('scratch', () => {
  it('scratchpad tests', () => {
    let time = dateTimeParse("2025-11-02 00:30:00", {timeZone: "America/Boise"});
    time = time.startOf("h");
    console.log("truncated", time)
    time = time.add(1, "h")
    console.log("add", time)
    time = time.add(1, "h")
    console.log("add", time)
    time = time.add(1, "h")
    console.log("add", time)
  });

  it('tz truncate test', () => {
    let time = dateTime();
    let t2 = dateTime(time).startOf("h");
    console.log("t2", t2, time);
    let diff = time.diff(t2, "m", false);
    console.log(diff);
  });

  it('API introspect', () => {
    let time = dateTime();
    for (const key in time) {
      console.log(key);
    }
  });

  it('next major', () => {
    let time = dateTime();
    console.log("end", time.endOf("h"))
    console.log("start", time.startOf("h"))
    console.log("start+end", time.startOf("h").endOf("h"))
  });
});
