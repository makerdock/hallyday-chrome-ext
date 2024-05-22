import { Fragment, useEffect, useState } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { getCurrentUserTeamId } from "../../../utils/supabase";
export default function PlaybookDropdown() {
  const [selected, setSelected] = useState(null);
  const [playbookList, setPlaybookList] = useState([]);

  useEffect(() => {
    getPlaybookList();
  }, []);

  async function getPlaybookList() {
    const temaId = await getCurrentUserTeamId();
    try {
      if (!temaId) {
        throw new Error("Team Id not found");
      }
      const response = await fetch(
        `http://localhost:3000/api/playbook/list?team_id=${temaId}`
      );

      if (!response.ok) {
        throw new Error(
          `Error fetching playbook list: ${response.status} ${response.statusText}`
        );
      }

      const playbook = await response.json();
      console.log("[playbook LIST DATA]", playbook);

      setPlaybookList(playbook);
      setSelected(playbook[0]);
    } catch (error) {
      console.error("Error while fetching playbook list", error.message);
    }
  }

  const handleChange = (event) => {
    const title = event.target.value;
    const selectedObject = playbookList.find(
      (option) => option.title === title
    );
    selected(selectedObject);
  };

  return (
    <div className="m-4 z-50">
      <p className="mb-2">Select the playbook</p>
      <Listbox value={selected} onChange={handleChange}>
        <div className="relative mt-1">
          <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
            <span className="block truncate">
              {selected ? selected.title : "Loading..."}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
              {playbookList.map((playbook) => (
                <Listbox.Option
                  key={playbook.id}
                  className={({ active }) =>
                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                      active ? "bg-gray-100 text-gray-900" : "text-gray-900"
                    }`
                  }
                  value={playbook.title}
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={`block truncate ${
                          selected ? "font-medium" : "font-normal"
                        }`}
                      >
                        {playbook.title}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-600">
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}
