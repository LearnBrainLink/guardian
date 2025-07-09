import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const defaultFilterLists = [
  {
    id: 'easylist',
    name: 'EasyList',
    description: 'The primary filter list that removes most ads from international webpages, including unwanted frames, images, and objects.',
    url: 'https://easylist.to/easylist/easylist.txt'
  },
  {
    id: 'easyprivacy',
    name: 'EasyPrivacy',
    description: 'A supplementary filter list that completely removes all forms of tracking from the internet, including web bugs, tracking scripts and information collectors.',
    url: 'https://easylist.to/easylist/easyprivacy.txt'
  },
  {
    id: 'peter-lowe-list',
    name: "Peter Lowe's Ad and tracking server list",
    description: 'A widely respected list of ad and tracking servers.',
    url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext'
  },
];

const Settings = () => {
  const [enabledLists, setEnabledLists] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load enabled lists from storage
    chrome.storage.local.get('enabledFilterLists', (data) => {
      if (data.enabledFilterLists) {
        setEnabledLists(data.enabledFilterLists);
      } else {
        // Set default if nothing is in storage
        setEnabledLists({ 'easylist': true });
      }
    });
  }, []);

  const handleToggle = (listId: string, checked: boolean) => {
    const newEnabledLists = { ...enabledLists, [listId]: checked };
    setEnabledLists(newEnabledLists);
    
    // Save to storage and notify background script
    chrome.storage.local.set({ enabledFilterLists: newEnabledLists });
    chrome.runtime.sendMessage({ action: 'update_filter_lists' });
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="pb-4 border-b mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Guardian Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage filter lists, view stats, and configure your browsing protection.
        </p>
      </header>

      <main>
        <Card>
          <CardHeader>
            <CardTitle>Filter Lists</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {defaultFilterLists.map((list) => (
              <div key={list.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <Label htmlFor={list.id} className="font-semibold">{list.name}</Label>
                  <p className="text-sm text-muted-foreground">{list.description}</p>
                </div>
                <Switch
                  id={list.id}
                  checked={!!enabledLists[list.id]}
                  onCheckedChange={(checked) => handleToggle(list.id, checked)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings; 