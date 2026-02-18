import React, { useEffect, useMemo, useState } from "react";
import {
  OpsSyllabusProgrammesResponse,
  listOpsSyllabusProgrammes,
} from "../../src/services/backendApi";

const OpsSyllabusPage: React.FC = () => {
  const [data, setData] = useState<OpsSyllabusProgrammesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProgrammeKey, setSelectedProgrammeKey] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listOpsSyllabusProgrammes({
        search: search.trim() || undefined,
      });
      setData(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load syllabus programmes.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [search]);

  const selectedProgramme = useMemo(() => {
    if (!data || !selectedProgrammeKey) return null;
    for (const program of data.items) {
      for (const programme of program.programmes) {
        const key = `${program.program}::${programme.name}`;
        if (key === selectedProgrammeKey) {
          return {
            programName: program.program,
            programmeName: programme.name,
            years: programme.years,
          };
        }
      }
    }
    return null;
  }, [data, selectedProgrammeKey]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <h1 className="text-2xl font-bold text-slate-900">Syllabus</h1>
        <p className="mt-1 text-sm text-slate-500">
          Programs and nested programmes extracted from curriculum data.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search program or programme..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => setSearch(searchInput)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Search
          </button>
          <button
            onClick={() => {
              setSearchInput("");
              setSearch("");
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Programs</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{data?.totalPrograms ?? 0}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase font-semibold text-slate-500">Programmes</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {data?.totalProgrammes ?? 0}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Programs</h2>
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!loading && (data?.items.length ?? 0) === 0 && (
            <div className="text-sm text-slate-500">No syllabus programs found.</div>
          )}

          {data?.items.map((program) => (
            <div key={program.program} className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{program.program}</h3>
                  <p className="text-xs text-slate-500">
                    {program.totalProgrammes} programme(s) | {program.totalChunks} chunk(s)
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  {program.totalSources} source(s)
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-2">Programme</th>
                      <th className="px-4 py-2">Chunks</th>
                      <th className="px-4 py-2">Sources</th>
                      <th className="px-4 py-2">Years</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {program.programmes.map((item) => (
                      <tr
                        key={`${program.program}-${item.name}`}
                        className={`cursor-pointer ${
                          selectedProgrammeKey === `${program.program}::${item.name}`
                            ? "bg-blue-50"
                            : ""
                        }`}
                        onClick={() => setSelectedProgrammeKey(`${program.program}::${item.name}`)}
                      >
                        <td className="px-4 py-2 font-medium text-slate-800">{item.name}</td>
                        <td className="px-4 py-2 text-slate-700">{item.chunkCount}</td>
                        <td className="px-4 py-2 text-slate-700">{item.sourceCount}</td>
                        <td className="px-4 py-2 text-slate-700">{item.years.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Programme Years</h2>
        </div>
        <div className="p-5">
          {!selectedProgramme && (
            <div className="text-sm text-slate-500">
              Select a programme to view its years (e.g., First Year).
            </div>
          )}
          {selectedProgramme && (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">{selectedProgramme.programName}</span>
                {" / "}
                <span className="font-medium text-slate-900">
                  {selectedProgramme.programmeName}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {selectedProgramme.years.length === 0 && (
                  <div className="text-sm text-slate-500">No year labels found.</div>
                )}
                {selectedProgramme.years.map((year) => (
                  <div
                    key={`${selectedProgrammeKey}-${year.name}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="text-sm font-medium text-slate-900">{year.name}</div>
                    <div className="text-xs text-slate-500">{year.chunkCount} chunk(s)</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default OpsSyllabusPage;
