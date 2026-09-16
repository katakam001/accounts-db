module.exports = {
  stages: {
    configuration: {
      stage1a: {
        stage: 1,
        tables: [
          "group_list",
          "categories",
          "items",
          "units",
          "fields",
          "areas",
          "brokers"
        ],
        order: [
          "group_list",
          "categories",
          "items",
          "units",
          "fields",
          "areas",
          "brokers"
        ],
        conflictFields: {
          group_list: ["name", "user_id", "financial_year"],
          categories: ["name", "user_id", "financial_year"],
          items: ["name", "user_id", "financial_year"],
          units: ["name", "user_id", "financial_year"],
          fields: ["field_name", "user_id", "financial_year"],
          areas: ["name", "user_id", "financial_year"]
        },
        specialHandling: {
          brokers: "whereClause"
        },
        whereClauseFields: {
          brokers: ["name", "contact", "email", "user_id", "financial_year"]
        },
        functionalUnique: {
          group_list: ["name"],
          categories: ["name"],
          items: ["name"],
          units: ["name"],
          fields: ["field_name"],
          areas: ["name"]
        }
      },
      stage1b: {
        stage: 2,
        // ✅ Accounts + independents that depend only on Stage1a
        groups: [
          {
            name: "account",
            parents: ["account_list"],   // ✅ only account_list is parent
            tables: ["account_list", "addresses", "account_group"],
            order: ["account_list", "addresses", "account_group"],
            joinKeys: {
              "addresses.account_id": "account_list.id",
              "account_group.account_id": "account_list.id"
            },
            userScoped: {
              account_list: true,
              addresses: false,
              account_group: false
            }
          }
        ],
        tables: ["category_units", "conversions", "opening_stock"],
        order: ["account", "category_units", "conversions", "opening_stock"],
        // ✅ Conflict handling rules
        conflictFields: {
          account_list: ["name", "user_id", "financial_year"],
          category_units: ["category_id", "unit_id",]
        },
        specialHandling: {
          opening_stock: "whereClause",
          conversions: "whereClause"
        },
        whereClauseFields: {
          conversions: ["from_unit_id", "to_unit_id", "user_id", "financial_year"],
          opening_stock: ["item_id", "user_id", "financial_year"]
        },
        // ✅ Functional uniqueness (case-insensitive matching)
        functionalUnique: {
          account_list: ["name"],
          category_units: []
        },
        // ✅ New config: which fields to merge
        mergeFields: {
          account_list: ["debit_balance", "credit_balance"]
        },

        // ✅ User-scoped tables
        userScoped: {
          category_units: true,
          conversions: true,
          opening_stock: true
        },

        // ✅ Mapping keys for foreign references
        mappingKeys: {
          category_units: {
            category_id: "categories.id",
            unit_id: "units.id"
          },
          conversions: {
            from_unit_id: "units.id",
            to_unit_id: "units.id"
          },
          opening_stock: {
            item_id: "items.id"
          }
        }
      },
      stage1c: {
        stage: 3,
        // ✅ Groups
        groups: [
          {
            name: "yield",
            parents: ["raw_items"], // raw_items is parent for processed_items
            tables: ["raw_items", "processed_items"],
            order: ["raw_items", "processed_items"],
            joinKeys: {
              "processed_items.raw_item_id": "raw_items.id"
            },
            mappingKeys: {
              raw_items: {
                item_id: "items.id",
                unit_id: "units.id"
              },
              processed_items: {
                raw_item_id: "raw_items.id",
                item_id: "items.id",
                unit_id: "units.id",
                conversion_id: "conversions.id"
              }
            },
            userScoped: {
              raw_items: true,
              processed_items: true
            }
          }
        ],
        // ✅ Independent tables
        tables: ["fields_mapping"],

        // ✅ Execution order
        order: ["fields_mapping", "yield"],

        // ✅ Conflict handling rules
        conflictFields: {
          fields_mapping: ["category_id", "field_id"]
        },

        specialHandling: {
          raw_items: "whereClause",
          processed_items: "whereClause"
        },
        whereClauseFields: {
          raw_items: ["item_id", "unit_id", "user_id", "financial_year"],
          processed_items: ["raw_item_id", "item_id", "unit_id", "conversion_id", "user_id", "financial_year"]
        },
        // ✅ Functional uniqueness
        functionalUnique: {
          fields_mapping: [],
        },

        // ✅ Merge fields
        mergeFields: {
          processed_items: ["percentage"]
        },

        // ✅ User-scoped tables
        userScoped: {
          fields_mapping: true,
          raw_items: true,
          processed_items: true
        },

        // ✅ Mapping keys for foreign references
        mappingKeys: {
          fields_mapping: {
            account_id: "account_list.id",
            category_id: "categories.id",
            field_id: "fields.id"
          }
        }
      }
    },
    data: {
      stage2a: {
        stage: 4,
        groups: [
          {
            name: "journalEntries",
            parents: ["journal_entries"],
            tables: ["journal_entries", "journal_items"],
            order: ["journal_entries", "journal_items"],
            joinKeys: {
              "journal_items.journal_id": "journal_entries.id"
            },
            mappingKeys: {
              journal_items: {
                account_id: "account_list.id",
                group_id: "group_list.id"
              }
            },
            userScoped: {
              journal_entries: true,
              journal_items: false
            }
          }
        ],
        order: ["journalEntries"],
        specialHandling: {
          journal_entries: "whereClause"
        },
        whereClauseFields: {
          journal_entries: ["journal_date", "user_id", "financial_year", "type", "transaction_id"],
        },
      },
      stage2b: {
        stage: 5,
        groups: [
          {
            name: "invoices",
            parents: ["journal_entries"],
            tables: ["journal_entries", "journal_items", "entries", "entry_fields"],
            order: ["journal_entries", "journal_items", "entries", "entry_fields"],
            joinKeys: {
              "journal_items.journal_id": "journal_entries.id",
              "entries.journal_id": "journal_entries.id",
              "entry_fields.entry_id": "entries.id"
            },
            mappingKeys: {
              entries: {
                account_id: "account_list.id",
                category_account_id: "account_list.id",
                category_id: "categories.id",
                item_id: "items.id",
                unit_id: "units.id",
                journal_id: "journal_entries.id"
              },
              entry_fields: {
                field_id: "fields.id"
              }
            },
            userScoped: {
              journal_entries: true,
              journal_items: false,
              entries: true,
              entry_fields: false
            }
          }
        ],
        order: ["invoices"],
        specialHandling: {
          journal_entries: "whereClause"
        },
        whereClauseFields: {
          journal_entries: ["journal_date", "user_id", "financial_year", "type", "invoice_seq_id"],
        },
      },

      stage2c: {
        stage: 6,
        groups: [
          {
            name: "production_entries_group",
            parents: ["production_entries"],
            tables: ["production_entries"],      // grouped table set
            order: ["production_entries"],       // execution order inside group
            joinType: "self",                    // self-join group
            parentKey: "id",
            childKey: "production_entry_id",
            mappingKeys: {
              production_entries: {
                raw_item_id: "items.id",
                item_id: "items.id",
                unit_id: "units.id",
                conversion_id: "conversions.id",
                production_entry_id: "production_entries.id"
              }
            },
            userScoped: {
              production_entries: true
            }
          }
        ],
        tables: ["cash_entries", "cash_entries_batch"],
        order: ["cash_entries", "cash_entries_batch", "production_entries_group"],
        conflictFields: {
          cash_entries: ["transaction_id", "user_id", "financial_year", "is_cash_adjustment"],
          cash_entries_batch: ["transaction_id", "user_id", "financial_year", "is_cash_adjustment"]
        },
        mappingKeys: {
          cash_entries: {
            account_id: "account_list.id",
            group_id: "group_list.id"
          },
          cash_entries_batch: {
            account_id: "account_list.id",
            group_id: "group_list.id"
          }
        },
        userScoped: {
          cash_entries: true,
          cash_entries_batch: true
        },
        specialHandling: {
          production_entries: "whereClause"
        },
        whereClauseFields: {
          production_entries: ["raw_item_id", "item_id", "unit_id", "production_date", "user_id", "financial_year", "production_seq_id"],
        },
      },
      stage2d: {
        stage: 7,
        groups: [
          {
            name: "cashSales",
            parents: ["cash_sale_entries"],

            tables: [
              "cash_sale_entries",
              "cash_entry_fields",
            ],
            order: [
              "cash_sale_entries",
              "cash_entry_fields",
            ],
            joinKeys: {
              // cash_entry_fields belong to a sale entry
              "cash_entry_fields.cash_sale_entry_id": "cash_sale_entries.id",
            },
            mappingKeys: {
              cash_sale_entries: {
                account_id: "account_list.id",
                category_account_id: "account_list.id",
                category_id: "categories.id",
                item_id: "items.id",
                unit_id: "units.id"
              },
              cash_entry_fields: {
                field_id: "fields.id"
              }
            },
            userScoped: {
              cash_sale_entries: true,
              cash_entry_fields: false
            }
          }
        ],
        order: ["cashSales"]
      }
    },
    finalize: {
      finalize: {
        stage: 8,
        tables: [],
        order: []
      }
    },
    delete: {
      stage3a: {
        stage: 9,
        groups: [
          {
            name: "entriesGroup",
            parents: ["entries"],
            tables: ["entries", "entry_fields"],
            order: ["entries", "entry_fields"]
          },
          {
            name: "journalGroup",
            parents: ["journal_entries"],
            tables: ["journal_entries", "journal_items"],
            order: ["journal_entries", "journal_items"]
          },
          {
            name: "cashSalesGroup",
            parents: ["cash_sale_entries"],
            tables: ["cash_sale_entries", "cash_entry_fields", "daily_cash_entry_summary", "cash_sale_entry_links"],
            order: ["cash_sale_entries", "cash_entry_fields", "daily_cash_entry_summary", "cash_sale_entry_links"]
          }
        ],
        tables: ["production_entries", "cash_entries_batch", "cash_entries"],
        order: ["production_entries", "cash_entries_batch", "cash_entries", "entriesGroup", "journalGroup", "cashSalesGroup"]
      },
      stage3b: {
        stage: 10,
        groups: [
          {
            name: "yieldGroup",
            parents: ["raw_items"],
            tables: ["raw_items", "processed_items"],
            order: ["raw_items", "processed_items"]
          },
          {
            name: "accountsGroup",
            parents: ["account_list"],
            tables: ["account_list", "addresses", "account_group"],
            order: ["account_list", "addresses", "account_group"]
          }
        ],
        tables: ["fields_mapping", "opening_stock", "conversions", "areas", "brokers"],
        order: ["yieldGroup", "accountsGroup", "fields_mapping", "opening_stock", "conversions", "areas", "brokers"]
      },
      stage3c: {
        stage: 11,
        tables: ["group_list", "categories", "items", "units", "fields"],
        order: ["group_list", "categories", "items", "units", "fields"]
      }
    }

  }
};
