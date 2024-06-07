import React, { useEffect, useState } from "react";
import { getCurrentUserTeamId } from "../../../utils/supabase";

interface Playbook {
  id: number;
  status_desc: string | null;
  team_id: string;
  title: string;
}

export default function PlaybookDropdown() {
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [playbookList, setPlaybookList] = useState<Playbook[]>([]);
  const [loader, setLoader] = useState<boolean>(false);

  useEffect(() => {
    getPlaybookList();
  }, []);

  useEffect(() => {
    loadSelectedPlaybook();
  }, [playbookList]);

  async function getPlaybookList() {
    const teamId = await getCurrentUserTeamId();
    try {
      setLoader(true);
      if (!teamId) {
        throw new Error("Team Id not found");
      }
      const response = await fetch(
        `http://localhost:3000/api/playbook/list?team_id=${teamId}`
      );

      if (!response.ok) {
        throw new Error(
          `Error fetching playbook list: ${response.status} ${response.statusText}`
        );
      }

      const playbook: Playbook[] = await response.json();
      console.log("[playbook LIST DATA]", playbook);

      setPlaybookList(playbook);
      if (playbook.length > 0) {
        setSelected(playbook[0]);
      }
    } catch (error) {
      console.error("Error while fetching playbook list", error.message);
    } finally {
      setLoader(false);
    }
  }

  const loadSelectedPlaybook = () => {
    chrome.storage.local.get("selectedPlaybookId", (result) => {
      const selectedPlaybookId = result.selectedPlaybookId;
      if (selectedPlaybookId) {
        const selectedPlaybook = playbookList.find(
          (playbook) => playbook.id === selectedPlaybookId
        );
        setSelected(selectedPlaybook || null);
      } else {
        if (selected) {
          chrome.storage.local.set({ selectedPlaybookId: selected.id }, () => {
            console.log(
              `Selected playbook ID ${selected.id} saved to local storage.`
            );
          });
        }
      }
    });
  };

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(event.target.value, 10);
    const selectedObject =
      playbookList.find((option) => option.id === id) || null;
    setSelected(selectedObject);

    if (selectedObject) {
      chrome.storage.local.set(
        { selectedPlaybookId: selectedObject.id },
        () => {
          console.log(
            `Selected playbook ID ${selectedObject.id} saved to local storage.`
          );
        }
      );
    }
  };

  if (loader) {
    return <p className="m-4 z-50">Loading......</p>;
  }

  return (
    <div className="m-4 z-50">
      {playbookList.length > 0 && (
        <div className="relative h-14 w-full my-2">
          <select
            className="peer h-full w-full rounded-[7px] border border-gray-500 border-t-transparent bg-transparent px-3 py-2.5 font-sans text-sm font-normal  outline outline-0 transition-all placeholder-shown:border placeholder-shown:border-gray-500 placeholder-shown:border-t-blue-gray-500  focus:border-t-transparent focus:outline-0 disabled:border-0 disabled:bg-blue-gray-50"
            value={selected?.id || ""}
            onChange={(e) => {
              handleChange(e);
            }}
          >
            {playbookList.map((playbook) => (
              <option key={playbook.id} value={playbook.id}>
                {playbook.title}
              </option>
            ))}
          </select>
          <label className="before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight text-blue-gray-400 transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-gray-500 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-gray-500 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-blue-gray-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-900 peer-focus:before:border-t-2 peer-focus:before:border-l-2 peer-focus:border-gray-900 peer-focus:after:border-t-2 peer-focus:after:border-r-2 peer-focus:after:border-gray-900 peer-disabled:text-transparent peer-disabled:before:border-transparent peer-disabled:after:border-transparent peer-disabled:peer-placeholder-shown:text-blue-gray-500">
            Select the playbook
          </label>
        </div>
      )}
    </div>
  );
}
